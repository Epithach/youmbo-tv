import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { firstImage, loadVodDetails, type CatalogItem, type VodInfo } from '../../core/catalog';
import { displayTitle, resizePoster } from '../../core/catalog-display';
import type { XtreamCredentials } from '../../core/xtream';
import { Badges } from './FlixParts';

/** Attente avant de demander la fiche d'un film sélectionné (pas pendant un défilement). */
const DETAILS_DELAY_MS = 500;
/** Attente sur un titre avant d'en lancer la bande-annonce en fond, à la Netflix. */
const PREVIEW_DELAY_MS = 3000;

/** Lecteur YouTube sans cookies, avec le son, sans commandes, en boucle : un fond animé. */
const previewUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` +
  `?autoplay=1&controls=0&loop=1&playlist=${encodeURIComponent(id)}` +
  '&modestbranding=1&rel=0&playsinline=1&disablekb=1';

export const HERO_BUTTONS = ['▶ Lecture', 'Plus d’infos'] as const;

interface HeroProps {
  credentials: XtreamCredentials;
  item: CatalogItem | undefined;
  /** La bannière a le focus : ses boutons sont actifs. */
  focused: boolean;
  button: number;
  onPress: (button: number) => void;
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

  // Bande-annonce en fond après 3 s sur le même titre ; elle s'arrête dès qu'on bouge.
  const trailerId = () => movie()?.youtube_trailer || props.item?.trailer;
  const [preview, setPreview] = createSignal<string>();
  const [previewReady, setPreviewReady] = createSignal(false);
  createEffect(() => {
    // Changer de titre relance le délai, même si la bande-annonce est la même.
    void props.item?.id;
    const id = trailerId();
    setPreview(undefined);
    setPreviewReady(false);
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
        <section class="hero" classList={{ 'hero--focused': props.focused }}>
          <Show when={backdrop()}>
            {(src) => <img class="hero__backdrop" src={src()} alt="" />}
          </Show>
          <Show when={preview()}>
            {(id) => (
              <iframe
                class="hero__preview"
                classList={{ 'hero__preview--ready': previewReady() }}
                src={previewUrl(id())}
                title="Bande-annonce"
                allow="autoplay; encrypted-media"
                tabIndex={-1}
                // Le lecteur YouTube met un instant à démarrer : on attend pour un fondu propre.
                onLoad={() => setTimeout(() => setPreviewReady(true), 1200)}
              />
            )}
          </Show>
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
            <div class="hero__buttons">
              <For each={HERO_BUTTONS}>
                {(label, index) => (
                  <span
                    class="controls__button"
                    classList={{
                      'controls__button--focused': props.focused && index() === props.button,
                    }}
                    onClick={() => props.onPress(index())}
                  >
                    {label}
                  </span>
                )}
              </For>
            </div>
          </div>
        </section>
      )}
    </Show>
  );
}
