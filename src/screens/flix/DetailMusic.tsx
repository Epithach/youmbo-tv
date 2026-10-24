import { createEffect, createResource, createSignal, onCleanup, Show } from 'solid-js';
import { looksLikeAnime, pickOpening, searchAnime, searchTitle } from '../../core/anime-themes';
import { loadCategories, type CatalogItem } from '../../core/catalog';
import { loadVolume } from '../../core/storage';
import type { XtreamCredentials } from '../../core/xtream';

/** Attente avant de lancer la musique : pas pour une fiche ouverte puis quittée aussitôt. */
const START_DELAY_MS = 1500;
/** La musique de fond reste un peu en retrait du volume choisi pour les vidéos. */
const MUSIC_VOLUME = 0.6;

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

type Music = { kind: 'opening'; url: string } | { kind: 'trailer'; id: string };

/**
 * Musique de fond d'une fiche : l'opening de la saison pour un animé
 * (AnimeThemes), sinon la bande-annonce avec le son, en fond de la fiche.
 */
export function DetailMusic(props: DetailMusicProps) {
  const [music] = createResource(
    () => ({ item: props.item, season: props.season, trailer: props.trailerId }),
    async ({ item, season, trailer }): Promise<Music | undefined> => {
      const categories = await loadCategories(props.credentials, item.kind).catch(() => []);
      const category = categories.find((c) => c.category_id === item.categoryId)?.category_name;
      if (looksLikeAnime(item.name, category)) {
        const title = searchTitle(item.name);
        const results = await searchAnime(title).catch(() => []);
        const url = pickOpening(results, {
          title,
          kind: item.kind,
          season,
          year: props.year,
          random: Math.random(),
        });
        if (url) return { kind: 'opening', url };
      }
      return trailer ? { kind: 'trailer', id: trailer } : undefined;
    },
  );

  // La musique ne démarre qu'après une courte présence sur la fiche (et à chaque saison).
  const [started, setStarted] = createSignal(false);
  createEffect(() => {
    void music();
    setStarted(false);
    const timer = setTimeout(() => setStarted(true), START_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  const current = () => (started() && !props.paused ? music() : undefined);

  return (
    <Show when={current()}>
      {(playing) => (
        <Show
          when={playing().kind === 'opening' && playing()}
          fallback={
            <iframe
              class="detail__music-video"
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(
                (playing() as Extract<Music, { kind: 'trailer' }>).id,
              )}?autoplay=1&controls=0&loop=1&playlist=${encodeURIComponent(
                (playing() as Extract<Music, { kind: 'trailer' }>).id,
              )}&modestbranding=1&rel=0&playsinline=1&disablekb=1`}
              title="Bande-annonce (musique de fond)"
              allow="autoplay; encrypted-media"
              tabIndex={-1}
            />
          }
        >
          {(opening) => (
            <audio
              class="detail__music"
              src={(opening() as Extract<Music, { kind: 'opening' }>).url}
              autoplay
              loop
              ref={(el) => (el.volume = loadVolume() * MUSIC_VOLUME)}
            />
          )}
        </Show>
      )}
    </Show>
  );
}
