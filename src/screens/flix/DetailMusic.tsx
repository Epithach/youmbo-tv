import { createEffect, createResource, createSignal, onCleanup, Show } from 'solid-js';
import { findOpenings, looksLikeAnime, pickOpening, type Opening } from '../../core/anime-themes';
import { loadCategories, type CatalogItem } from '../../core/catalog';
import { loadVolume } from '../../core/storage';
import type { XtreamCredentials } from '../../core/xtream';

/** Attente avant la bande-annonce : pas pour une fiche ouverte puis quittée aussitôt. */
const START_DELAY_MS = 800;
/** La musique de fond reste un peu en retrait du volume choisi pour les vidéos. */
const MUSIC_VOLUME = 0.6;

interface OpeningOptions {
  season?: number;
  year?: number;
}

/**
 * Openings d'un titre s'il s'agit d'un animé (sinon aucun). Appelée aussi
 * depuis le catalogue pour chercher en avance : AnimeThemes est lent.
 */
export async function animeOpenings(
  credentials: XtreamCredentials,
  item: CatalogItem,
  options: OpeningOptions = {},
): Promise<Opening[]> {
  const categories = await loadCategories(credentials, item.kind).catch(() => []);
  const category = categories.find((c) => c.category_id === item.categoryId)?.category_name;
  if (!looksLikeAnime(item.name, category)) return [];
  return findOpenings(item.name, { kind: item.kind, ...options }).catch(() => []);
}

interface DetailMusicProps {
  credentials: XtreamCredentials;
  item: CatalogItem;
  /** Séries : saison affichée (1 = première), pour l'opening de cette saison. */
  season?: number;
  /** Année de sortie (films), pour choisir le bon film d'animation. */
  year?: number;
  /** Bande-annonce YouTube du titre, si le fournisseur la donne. */
  trailerId?: string;
  /** Coupée pendant que la bande-annonce est ouverte en grand. */
  paused: boolean;
}

const trailerUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` +
  `?autoplay=1&controls=0&loop=1&playlist=${encodeURIComponent(id)}` +
  '&modestbranding=1&rel=0&playsinline=1&disablekb=1';

/**
 * Fond animé et musical d'une fiche : la bande-annonce démarre tout de
 * suite ; pour un animé, l'opening de la saison (AnimeThemes) la remplace
 * en fondu dès que sa vidéo joue (ou sa piste audio si la vidéo échoue).
 */
export function DetailMusic(props: DetailMusicProps) {
  const [opening] = createResource(
    () => ({ item: props.item, season: props.season, year: props.year }),
    async ({ item, season, year }) =>
      pickOpening(await animeOpenings(props.credentials, item, { season, year }), Math.random()),
  );

  // Changer de titre ou de saison relance le délai et le fondu.
  const [started, setStarted] = createSignal(false);
  const [videoPlaying, setVideoPlaying] = createSignal(false);
  const [videoFailed, setVideoFailed] = createSignal(false);
  createEffect(() => {
    void opening();
    void props.trailerId;
    setVideoPlaying(false);
    setVideoFailed(false);
    setStarted(false);
    const timer = setTimeout(() => setStarted(true), START_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  const active = () => !props.paused;
  const video = () => (active() && !videoFailed() ? opening()?.video : undefined);
  const audio = () =>
    active() && (videoFailed() || !opening()?.video) ? opening()?.audio : undefined;
  const trailer = () =>
    active() && started() && !videoPlaying() && !audio() ? props.trailerId : undefined;
  const setVolume = (el: HTMLMediaElement) => (el.volume = loadVolume() * MUSIC_VOLUME);

  return (
    <>
      <Show when={trailer()}>
        {(id) => (
          <iframe
            class="detail__music-video"
            src={trailerUrl(id())}
            title="Bande-annonce (musique de fond)"
            allow="autoplay; encrypted-media"
            tabIndex={-1}
          />
        )}
      </Show>
      <Show when={video()}>
        {(src) => (
          <video
            class="detail__opening"
            classList={{ 'detail__opening--playing': videoPlaying() }}
            src={src()}
            autoplay
            loop
            playsinline
            preload="auto"
            ref={setVolume}
            onPlaying={() => setVideoPlaying(true)}
            onError={() => setVideoFailed(true)}
          />
        )}
      </Show>
      <Show when={audio()}>
        {(src) => <audio class="detail__music" src={src()} autoplay loop ref={setVolume} />}
      </Show>
    </>
  );
}
