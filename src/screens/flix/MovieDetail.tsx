import { createMemo, createResource, createSignal, Show } from 'solid-js';
import {
  firstImage,
  loadCategory,
  loadVodDetails,
  type CatalogItem,
  type VodDetails,
} from '../../core/catalog';
import { displayTitle, durationMinutes, resizePoster } from '../../core/catalog-display';
import { library, progressKey } from '../../core/library';
import type { XtreamCredentials } from '../../core/xtream';
import { Menu, pressMenuItem, type MenuItem } from '../../ui/Menu';
import { clamp, useRemote } from '../../ui/remote';
import { DetailMusic } from './DetailMusic';
import { Badges, PosterStrip, Trailer } from './FlixParts';
import { formatTime } from './PlayerControls';

interface MovieDetailProps {
  credentials: XtreamCredentials;
  item: CatalogItem;
  onPlay: (item: CatalogItem, details: VodDetails | undefined, fromStart: boolean) => void;
  /** Ouvre un autre titre (titres similaires). */
  onOpen: (item: CatalogItem) => void;
  onBack: () => void;
}

/** Titres similaires affichés au plus. */
const SIMILAR_LIMIT = 20;

/**
 * Fiche d'un film, en grand format comme les séries : image plein écran,
 * note et titre en grand avec le résumé et les boutons à gauche ; durée et
 * titres similaires à droite (↓ pour y aller).
 */
export function MovieDetail(props: MovieDetailProps) {
  const [details] = createResource(() => loadVodDetails(props.credentials, props.item.id));
  const [similarSource] = createResource(() =>
    loadCategory(props.credentials, 'movies', props.item.categoryId),
  );
  const similar = createMemo(() =>
    (similarSource() ?? []).filter((i) => i.id !== props.item.id).slice(0, SIMILAR_LIMIT),
  );
  const [selected, setSelected] = createSignal(0);
  const [inSimilar, setInSimilar] = createSignal(false);
  const [similarIndex, setSimilarIndex] = createSignal(0);
  const [trailer, setTrailer] = createSignal(false);

  const info = () => details()?.info;
  const title = () => displayTitle(info()?.name || props.item.name);
  /** Titre affiché en grand : sans l'année entre parenthèses, déjà dans les infos. */
  const bigTitle = () => title().replace(/\s*\(\d{4}\)\s*$/, '');
  const rating = () => {
    const value = Number(info()?.rating ?? props.item.rating);
    return value > 0 ? value.toFixed(1) : undefined;
  };
  const minutes = () => durationMinutes(info()?.duration);
  const year = () => info()?.releasedate?.slice(0, 4) || props.item.year;
  const backdrop = () =>
    firstImage(info()?.backdrop_path) ||
    props.item.backdrop ||
    info()?.movie_image ||
    props.item.poster;

  const resumeAt = () => library.resumePosition(progressKey('movie', props.item.id));
  const items = (): MenuItem[] => [
    ...(resumeAt()
      ? [
          {
            label: `Reprendre à ${formatTime(resumeAt()!)}`,
            onPress: () => props.onPlay(props.item, details(), false),
          },
          { label: 'Depuis le début', onPress: () => props.onPlay(props.item, details(), true) },
        ]
      : [{ label: 'Lecture', onPress: () => props.onPlay(props.item, details(), true) }]),
    {
      label: library.isFavorite(props.item) ? '♥ Dans ma liste' : '♡ Ma liste',
      onPress: () => library.toggleFavorite(props.item),
    },
    ...(info()?.youtube_trailer
      ? [{ label: '▶ Bande-annonce', onPress: () => setTrailer(true) }]
      : []),
    { label: 'Retour', onPress: () => props.onBack() },
  ];

  useRemote((key) => {
    if (trailer()) return; // La bande-annonce a sa propre télécommande.
    if (inSimilar()) {
      if (key === 'left' || key === 'right') {
        setSimilarIndex(clamp(similarIndex() + (key === 'left' ? -1 : 1), 0, similar().length - 1));
      } else if (key === 'ok') {
        const item = similar()[similarIndex()];
        if (item) props.onOpen(item);
      } else if (key === 'up') setInSimilar(false);
      else if (key === 'back') props.onBack();
      return;
    }
    if (key === 'left' || key === 'right') {
      setSelected(clamp(selected() + (key === 'left' ? -1 : 1), 0, items().length - 1));
    } else if (key === 'down' && similar().length > 0) setInSimilar(true);
    else if (key === 'ok') pressMenuItem(items(), selected());
    else if (key === 'back') props.onBack();
  });

  return (
    <div class="detail showcase">
      <Show when={resizePoster(backdrop(), 1280)}>
        {(src) => <img class="showcase__backdrop" src={src()} alt="" />}
      </Show>
      <div class="showcase__shade" />

      <div class="showcase__stage">
        <section class="showcase__main">
          <Show when={rating()}>
            <p class="showcase__rating">
              {rating()} <span>/ 10</span>
            </p>
          </Show>
          <h1 class="showcase__title detail__title">{bigTitle()}</h1>
          <Show
            when={!details.loading}
            fallback={<p class="showcase__plot">Chargement de la fiche…</p>}
          >
            <p class="showcase__plot">
              <svg class="showcase__plot-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10.5" />
                <path d="M10 8.5v7l5.5-3.5z" />
              </svg>
              <span>{info()?.plot || info()?.description || 'Pas de résumé disponible.'}</span>
            </p>
          </Show>
          <Badges age={info()?.age || info()?.mpaa_rating} year={year()} genre={info()?.genre} />
          <Menu
            items={items()}
            selected={inSimilar() ? -1 : selected()}
            onSelect={setSelected}
            direction="row"
          />
        </section>

        <section class="showcase__side">
          <div class="showcase__count">
            <span class="showcase__count-number">{minutes() ?? year() ?? '–'}</span>
            <div class="showcase__count-text">
              <strong>{minutes() ? 'minutes' : 'Film'}</strong>
              <small>
                {info()?.director ? `Réalisation : ${info()?.director}` : (info()?.genre ?? '')}
              </small>
            </div>
            <span class="showcase__count-line" />
          </div>
          <Show when={info()?.cast || info()?.actors}>
            <p class="showcase__cast">Avec {info()?.cast || info()?.actors}</p>
          </Show>
          <PosterStrip
            title="Titres similaires"
            items={similar()}
            selected={similarIndex()}
            active={inSimilar()}
            onOpen={props.onOpen}
          />
        </section>
      </div>

      <DetailMusic
        credentials={props.credentials}
        item={props.item}
        year={Number(year()) || undefined}
        trailerId={info()?.youtube_trailer}
        paused={trailer()}
      />
      <Show when={trailer() && info()?.youtube_trailer}>
        {(id) => <Trailer youtubeId={id()} onClose={() => setTrailer(false)} />}
      </Show>
    </div>
  );
}
