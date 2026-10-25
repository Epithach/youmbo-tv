import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { firstImage, loadVodDetails, type CatalogItem, type VodInfo } from '../../core/catalog';
import { displayTitle, resizePoster } from '../../core/catalog-display';
import { loadVolume } from '../../core/storage';
import type { XtreamCredentials } from '../../core/xtream';
import { YoutubeBackground } from '../../ui/YoutubeBackground';
import { Badges } from './FlixParts';

/** Attente avant de demander la fiche d'un film sélectionné (pas pendant un défilement). */
const DETAILS_DELAY_MS = 500;
/** Attente sur un titre avant de lancer (muette et invisible) sa bande-annonce en fond. */
const PREVIEW_DELAY_MS = 1000;
/** La bande-annonce apparaît, avec le son en fondu, 6 s après la sélection du titre. */
const PREVIEW_REVEAL_MS = 6000 - PREVIEW_DELAY_MS;

interface HeroProps {
  credentials: XtreamCredentials;
  item: CatalogItem | undefined;
}

/**
 * Bannière en haut de YoumboFlix, à la Netflix : image de fond, titre, note,
 * âge et résumé du titre mis en avant (ou de l'affiche sélectionnée).
 * Les séries ont déjà tout dans leur liste ; les films demandent leur fiche.
 */
export function Hero(props: HeroProps) {
  const [info, setInfo] = createSignal<{ id: number; info: VodInfo }>();

  createEffect(() => {
    const item = props.item;
    if (!item || item.kind !== 'movies') return;
    const timer = setTimeout(() => {
      loadVodDetails(props.credentials, item.id).then(
        (details) => setInfo({ id: item.id, info: details.info }),
        () => undefined,
      );
    }, DETAILS_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  /** Fiche du film affiché (pas celle d'un film vu juste avant). */
  const movie = () => (info()?.id === props.item?.id ? info()?.info : undefined);

  // Bande-annonce lancée après 1 s sur le même titre, visible à 6 s ; elle s'arrête dès qu'on bouge.
  const trailerId = () => movie()?.youtube_trailer || props.item?.trailer;
  const [preview, setPreview] = createSignal<string>();
  createEffect(() => {
    // Changer de titre relance le délai, même si la bande-annonce est la même.
    void props.item?.id;
    const id = trailerId();
    setPreview(undefined);
    if (!id) return;
    const timer = setTimeout(() => setPreview(id), PREVIEW_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });
  const backdrop = () =>
    resizePoster(firstImage(movie()?.backdrop_path) ?? props.item?.backdrop, 1280);
  const plot = () => movie()?.plot || movie()?.description || props.item?.plot;

  return (
    <Show when={props.item}>
      {(item) => (
        <section class="hero">
          {/* Recréées à chaque titre : image et texte du nouveau titre arrivent en fondu. */}
          <Show when={backdrop()} keyed>
            {(src) => <img class="hero__backdrop" src={src} alt="" />}
          </Show>
          <Show when={preview()}>
            {(id) => (
              <YoutubeBackground
                id={id()}
                class="hero__preview"
                title="Bande-annonce"
                volume={loadVolume()}
                revealAfterMs={PREVIEW_REVEAL_MS}
              />
            )}
          </Show>
          <Show when={item().id} keyed>
            <div class="hero__content">
              <h1 class="hero__title">{displayTitle(movie()?.name || item().name)}</h1>
              <Badges
                rating={movie()?.rating ?? item().rating}
                age={movie()?.age || movie()?.mpaa_rating}
                year={movie()?.releasedate?.slice(0, 4) ?? item().year}
                genre={movie()?.genre ?? item().genreText}
                duration={movie()?.duration}
              />
              <Show when={plot()}>
                <p class="hero__plot">{plot()}</p>
              </Show>
            </div>
          </Show>
        </section>
      )}
    </Show>
  );
}
