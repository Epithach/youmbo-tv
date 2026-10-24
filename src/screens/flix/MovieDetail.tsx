import { createMemo, createResource, createSignal, Show } from 'solid-js';
import {
  firstImage,
  loadCategory,
  loadVodDetails,
  type CatalogItem,
  type VodDetails,
} from '../../core/catalog';
import { displayTitle, resizePoster } from '../../core/catalog-display';
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
 * Fiche d'un film : affiche, note, âge, résumé et boutons (Lecture, Ma liste,
 * Bande-annonce) ; ↓ descend sur les titres similaires (même catégorie).
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
    <div class="detail">
      <Show when={resizePoster(firstImage(info()?.backdrop_path), 1280)}>
        {(src) => <img class="detail__backdrop" src={src()} alt="" />}
      </Show>
      <div class="detail__content">
        <Show when={resizePoster(info()?.movie_image ?? props.item.poster, 342)}>
          {(src) => <img class="detail__poster" src={src()} alt="" />}
        </Show>
        <div class="detail__text">
          <h1 class="detail__title">{displayTitle(info()?.name || props.item.name)}</h1>
          <Badges
            rating={info()?.rating ?? props.item.rating}
            age={info()?.age || info()?.mpaa_rating}
            year={info()?.releasedate?.slice(0, 4)}
            genre={info()?.genre}
            duration={info()?.duration}
          />
          <Show
            when={!details.loading}
            fallback={<p class="detail__plot">Chargement de la fiche…</p>}
          >
            <p class="detail__plot">
              {info()?.plot || info()?.description || 'Pas de résumé disponible.'}
            </p>
            <Show when={info()?.director}>
              <p class="detail__credits">Réalisation : {info()?.director}</p>
            </Show>
            <Show when={info()?.cast || info()?.actors}>
              <p class="detail__credits">Avec : {info()?.cast || info()?.actors}</p>
            </Show>
          </Show>
          <Menu
            items={items()}
            selected={inSimilar() ? -1 : selected()}
            onSelect={setSelected}
            direction="row"
          />
          <PosterStrip
            title="Titres similaires"
            items={similar()}
            selected={similarIndex()}
            active={inSimilar()}
            onOpen={props.onOpen}
          />
        </div>
      </div>
      <DetailMusic
        credentials={props.credentials}
        item={props.item}
        year={Number(info()?.releasedate?.slice(0, 4)) || undefined}
        trailerId={info()?.youtube_trailer}
        paused={trailer()}
      />
      <Show when={trailer() && info()?.youtube_trailer}>
        {(id) => <Trailer youtubeId={id()} onClose={() => setTrailer(false)} />}
      </Show>
    </div>
  );
}
