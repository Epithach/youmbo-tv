/**
 * Catalogue fictif du faux serveur Xtream : généré par du code (aucune donnée
 * d'un vrai fournisseur), stable d'un lancement à l'autre. Il reprend les
 * conventions de nommage des fournisseurs pour exercer le tri par pays, par
 * langue et par genre.
 */

export interface Category {
  category_id: string;
  category_name: string;
  parent_id: 0;
}

const category = (id: number, name: string): Category => ({
  category_id: String(id),
  category_name: name,
  parent_id: 0,
});

/** Choix déterministe dans une liste (même résultat à chaque lancement). */
const pick = <T>(list: readonly T[], n: number): T => list[n % list.length];

/** Date d'ajout fictive : du plus récent au plus ancien selon l'identifiant. */
const BASE_TIME = 1_790_000_000;
const added = (n: number) => String(BASE_TIME - n * 3600);

/* --- Chaînes --- */

export const liveCategories = [
  category(1, '|EU| FRANCE GÉNÉRAL'),
  category(2, '|EU| FRANCE SPORTS'),
  category(3, '|EU| FRANCE INFO'),
  category(4, '|EU| BELGIQUE HD'),
  category(5, '|UK| GENERAL'),
  category(6, '|DE| SPORT'),
  category(7, '|AR| BEIN SPORTS'),
];

const CHANNELS: Record<string, { prefix: string; names: string[] }> = {
  '1': {
    prefix: 'FR',
    names: ['Chaîne Une', 'Chaîne Deux', 'Chaîne Trois', 'Ciné Club', 'Jeunesse', 'Séries Plus'],
  },
  '2': {
    prefix: 'FR',
    names: ['Sport Direct 1', 'Sport Direct 2', 'Foot Live', 'Mécaniques', 'DAZN 1', 'DAZN 2', 'DAZN 3'],
  },
  '3': { prefix: 'FR', names: ['Info Continu', 'Info Monde', 'Parlement TV'] },
  '4': { prefix: 'BE', names: ['La Une Belge', 'Brussel TV', 'Wallonie Plus'] },
  '5': { prefix: 'UK', names: ['Channel One', 'Channel Two', 'Kids Club'] },
  '6': { prefix: 'DE', names: ['Sport Eins', 'Fussball Live'] },
  '7': { prefix: '', names: ['Bein Sports Demo 1', 'Bein Sports Demo 2'] },
};

export interface LiveStream {
  num: number;
  name: string;
  stream_type: 'live';
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  category_id: string;
  /** Replay : les chaînes françaises gardent 3 jours de programmes. */
  tv_archive: number;
  tv_archive_duration: number;
}

export const liveStreams: LiveStream[] = [];
for (const [categoryId, { prefix, names }] of Object.entries(CHANNELS)) {
  // Faux titre de section, comme chez beaucoup de fournisseurs (filtré par l'app).
  if (categoryId === '1') names.unshift('##### FRANCE #####');
  for (const name of names) {
    const id = 1000 + liveStreams.length;
    liveStreams.push({
      num: liveStreams.length + 1,
      name: prefix && !name.startsWith('#') ? `${prefix} - ${name}` : name,
      stream_type: 'live',
      stream_id: id,
      stream_icon: `/mock-image/logo-${id}.svg`,
      epg_channel_id: `demo.${id}`,
      category_id: categoryId,
      tv_archive: prefix === 'FR' ? 1 : 0,
      tv_archive_duration: prefix === 'FR' ? 3 : 0,
    });
  }
}

const SHOWS = [
  'Journal de 20h',
  'Météo',
  'Grand Débat',
  'Le Magazine du Sport',
  'Film : Les Voyageurs',
  'Série : Brigade Nord',
  'Dessins animés',
  'Documentaire : Océans',
];

/**
 * Programme d'une chaîne : `count` créneaux de 30 min, à partir de `fromSlot`
 * créneaux avant l'heure actuelle (0 : le créneau en cours).
 */
export function epgFor(streamId: number, now: number, count: number, fromSlot = 0) {
  const slot = 1800;
  const start = (Math.floor(now / slot) - fromSlot) * slot;
  const archive = liveStreams.find((s) => s.stream_id === streamId)?.tv_archive === 1;
  return Array.from({ length: count }, (_, i) => {
    const begin = start + i * slot;
    const title = pick(SHOWS, streamId + begin / slot);
    return {
      title: Buffer.from(title, 'utf8').toString('base64'),
      description: Buffer.from(`« ${title} », émission de démonstration.`, 'utf8').toString(
        'base64',
      ),
      start_timestamp: String(begin),
      stop_timestamp: String(begin + slot),
      has_archive: archive && begin + slot <= now ? 1 : 0,
    };
  });
}

/** Genres affichés sur les fiches, selon la catégorie du film. */
const MOVIE_GENRES: Record<string, string> = {
  '102': 'Action, Aventure',
  '103': 'Comédie',
  '104': 'Animation, Familial',
  '105': 'Horreur, Thriller',
  '107': 'Action, Thriller',
};

/** Bande-annonce YouTube libre de droits (Big Buck Bunny, Blender Foundation). */
const SAMPLE_TRAILER = 'aqz-KE-bpKQ';
const AGES = ['', '10', '12', '16'];

/* --- Films --- */

export const vodCategories = [
  category(101, 'VOD - RÉCEMMENT AJOUTER [FR]'),
  category(102, 'VOD - ACTION [FR]'),
  category(103, 'VOD - COMEDIE [FR]'),
  category(104, 'VOD - ANIME [FR]'),
  category(105, 'VOD - HORREUR [FR]'),
  category(106, 'VOD - NETFLIX [FR]'),
  category(107, 'VOD - ACTION [EN]'),
];

const FR_TITLES = ['L’Ombre', 'Le Phare', 'La Course', 'Le Secret', 'La Nuit', 'Le Voyage'];
const FR_PLACES = ['du Nord', 'de Minuit', 'des Étoiles', 'du Désert', 'perdu', 'éternel'];
const EN_TITLES = ['The Last', 'Midnight', 'Silent', 'Golden', 'Broken', 'Hidden'];
const EN_PLACES = ['Road', 'Harbor', 'Signal', 'Kingdom', 'Mirror', 'Storm'];

export interface VodStream {
  num: number;
  name: string;
  stream_type: 'movie';
  stream_id: number;
  stream_icon: string;
  rating: string;
  added: string;
  category_id: string;
  container_extension: string;
}

/** Titre fictif unique, en français ou en anglais selon la catégorie. */
function movieTitle(n: number, english: boolean) {
  const [first, second] = english ? [EN_TITLES, EN_PLACES] : [FR_TITLES, FR_PLACES];
  const base = `${pick(first, n)} ${pick(second, Math.floor(n / first.length))}`;
  return n >= first.length * second.length ? `${base} ${Math.floor(n / 36) + 1}` : base;
}

export const vodStreams: VodStream[] = vodCategories.flatMap((c, ci) =>
  Array.from({ length: 14 }, (_, i) => {
    const n = ci * 14 + i;
    const english = c.category_name.endsWith('[EN]');
    const id = 5000 + n;
    return {
      num: n + 1,
      name: `${english ? 'EN' : 'FR'} - ${movieTitle(n, english)} (${2000 + (n % 26)})`,
      stream_type: 'movie' as const,
      stream_id: id,
      stream_icon: `/mock-photo/poster-${id}.svg`,
      rating: String(5 + (n % 5)),
      added: added(n),
      category_id: c.category_id,
      container_extension: 'mp4',
    };
  }),
);

/* --- Séries --- */

export const seriesCategories = [
  category(201, 'SRS - SERIES 2026 [FR]'),
  category(202, 'SRS - NETFLIX [FR]'),
  category(203, 'SRS - ENFANTS [FR]'),
  category(204, 'SRS - DRAMA [EN]'),
  category(205, 'SRS - MANGA [FR]'),
];

/**
 * Animés (seuls les titres sont réels) : de quoi tester la musique de fond des
 * fiches, qui va chercher l'opening de la saison sur AnimeThemes.
 */
const ANIME_TITLES = [
  'Jujutsu Kaisen (2020) (JP)',
  'Spy x Family (2022) (JP)',
  'One Piece (1999) (JP)',
  'Naruto (2002) (JP)',
  'Demon Slayer (2019) (JP)',
  'Frieren (2023) (JP)',
];

const SERIES_GENRES = [
  'Drame, Comédie',
  'Animation, Kids',
  'Crime, Mystère',
  'Action & Adventure, Science-Fiction & Fantastique',
  'Documentaire',
];

export interface Series {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  category_id: string;
  backdrop_path: string[];
}

export const series: Series[] = seriesCategories.flatMap((c, ci) =>
  Array.from({ length: c.category_id === '205' ? ANIME_TITLES.length : 10 }, (_, i) => {
    const n = ci * 10 + i;
    const english = c.category_name.endsWith('[EN]');
    const id = 8000 + n;
    const title =
      c.category_id === '205'
        ? ANIME_TITLES[i]
        : `${movieTitle(n + 7, english)} (${2015 + (n % 11)})`;
    return {
      num: n + 1,
      name: `${english ? 'EN' : 'FR'} - ${title}`,
      series_id: id,
      cover: `/mock-photo/poster-${id}.svg`,
      plot: 'Série de démonstration du faux serveur Xtream.',
      genre: ['203', '205'].includes(c.category_id) ? 'Animation, Kids' : pick(SERIES_GENRES, n),
      releaseDate: `${2015 + (n % 11)}-01-01`,
      last_modified: added(n),
      rating: String(6 + (n % 4)),
      category_id: c.category_id,
      backdrop_path: [`/mock-photo/backdrop-${id}.svg`],
      youtube_trailer: SAMPLE_TRAILER,
    };
  }),
);

/** Saisons et épisodes d'une série (2 ou 3 saisons de 6 épisodes). */
export function seriesInfo(show: Series) {
  const seasons = 2 + (show.series_id % 2);
  const episodes: Record<string, unknown[]> = {};
  for (let s = 1; s <= seasons; s++) {
    episodes[String(s)] = Array.from({ length: 6 }, (_, e) => ({
      id: `${show.series_id}${s}${e + 1}`,
      episode_num: e + 1,
      title: `${show.name} - S0${s}E0${e + 1} - Épisode ${e + 1}`,
      container_extension: 'mp4',
      info: {
        duration: '00:00:52',
        plot: `Épisode ${e + 1} de la saison ${s}.`,
        movie_image: `/mock-photo/backdrop-${show.series_id}${s}${e + 1}.svg`,
      },
    }));
  }
  return { info: { ...show, youtube_trailer: SAMPLE_TRAILER }, episodes };
}

export function movieInfo(movie: VodStream) {
  return {
    info: {
      name: movie.name.replace(/^\w+ - /, ''),
      plot: 'Film de démonstration du faux serveur Xtream, pour tester l’interface sans fournisseur.',
      genre: MOVIE_GENRES[movie.category_id] ?? 'Drame',
      director: 'Équipe Youmbo',
      cast: 'Acteur Un, Actrice Deux',
      releasedate: `${movie.name.match(/\((\d{4})\)/)?.[1] ?? '2020'}-01-01`,
      duration: '00:00:52',
      rating: movie.rating,
      movie_image: movie.stream_icon,
      backdrop_path: [`/mock-photo/backdrop-${movie.stream_id}.svg`],
      age: pick(AGES, movie.stream_id),
      youtube_trailer: SAMPLE_TRAILER,
    },
    movie_data: {
      stream_id: movie.stream_id,
      name: movie.name,
      container_extension: movie.container_extension,
    },
  };
}
