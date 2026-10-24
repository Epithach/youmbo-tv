import { describe, expect, it } from 'vitest';
import {
  looksLikeAnime,
  pickOpening,
  seasonOpenings,
  searchTitle,
  type AnimeResult,
} from './anime-themes';

/** Un opening avec ses vidéos 1080p et 720p et sa piste audio. */
const theme = (link: string) => ({
  type: 'OP',
  animethemeentries: [
    {
      videos: [
        { link: `${link}-1080.webm`, resolution: 1080, audio: { link: `${link}.ogg` } },
        { link: `${link}-720.webm`, resolution: 720, audio: { link: `${link}.ogg` } },
      ],
    },
  ],
});
const audios = (openings: { audio?: string }[]) => openings.map((o) => o.audio);

/** Réponse (simplifiée) d'AnimeThemes pour « Jujutsu Kaisen ». */
const jujutsu: AnimeResult[] = [
  {
    name: 'Jujutsu Kaisen',
    year: 2020,
    season: 'Fall',
    media_format: 'TV',
    animethemes: [theme('s1-op1'), theme('s1-op2')],
  },
  {
    name: 'Jujutsu Kaisen: Shimetsu Kaiyuu',
    year: 2026,
    season: 'Winter',
    media_format: 'TV',
    animethemes: [theme('s3-op1')],
  },
  {
    name: 'Jujutsu Kaisen 2nd Season',
    year: 2023,
    season: 'Summer',
    media_format: 'TV',
    animethemes: [theme('s2-op1'), theme('s2-op2')],
  },
  {
    name: 'Jujutsu Kaisen 0',
    year: 2021,
    season: 'Fall',
    media_format: 'MOVIE',
    animethemes: [theme('film-op1')],
  },
  { name: 'Autre œuvre', year: 2020, media_format: 'TV', animethemes: [theme('autre')] },
];

describe('searchTitle', () => {
  it('retire préfixe de langue et parenthèses', () => {
    expect(searchTitle('FR - Jujutsu Kaisen (2020) (JP)')).toBe('Jujutsu Kaisen');
  });
});

describe('seasonOpenings', () => {
  const options = { title: 'Jujutsu Kaisen', kind: 'series' as const };

  it('prend la N-ième saison TV dans l’ordre de diffusion', () => {
    expect(audios(seasonOpenings(jujutsu, { ...options, season: 1 }))).toEqual([
      's1-op1.ogg',
      's1-op2.ogg',
    ]);
    expect(audios(seasonOpenings(jujutsu, { ...options, season: 2 }))).toEqual([
      's2-op1.ogg',
      's2-op2.ogg',
    ]);
    expect(audios(seasonOpenings(jujutsu, { ...options, season: 3 }))).toEqual(['s3-op1.ogg']);
    // Saison inconnue d'AnimeThemes : la dernière disponible.
    expect(audios(seasonOpenings(jujutsu, { ...options, season: 7 }))).toEqual(['s3-op1.ogg']);
  });

  it('choisit la vidéo 720p, plus légère que le 1080p', () => {
    expect(seasonOpenings(jujutsu, { ...options, season: 2 })[0].video).toBe('s2-op1-720.webm');
  });

  it('prend le film de la bonne année', () => {
    expect(
      audios(seasonOpenings(jujutsu, { title: 'Jujutsu Kaisen', kind: 'movies', year: 2021 })),
    ).toEqual(['film-op1.ogg']);
  });

  it('ne renvoie rien sans résultat', () => {
    expect(seasonOpenings([], { title: 'Inconnu', kind: 'series', season: 1 })).toEqual([]);
  });
});

describe('pickOpening', () => {
  it('tire un opening au hasard parmi ceux de la saison', () => {
    const openings = [{ audio: 'a' }, { audio: 'b' }];
    expect(pickOpening(openings, 0)?.audio).toBe('a');
    expect(pickOpening(openings, 0.9)?.audio).toBe('b');
    expect(pickOpening([], 0.5)).toBeUndefined();
  });
});

describe('looksLikeAnime', () => {
  it.each([
    ['FR - Les 7 Chevaliers (2026) (JP)', undefined, true],
    ['FR - One Piece', 'SRS - MANGA [FR]', true],
    ['FR - Film', 'VOD - ANIME [FR]', true],
    ['FR - Seven Seconds (2018) (US)', 'SRS - NETFLIX [FR]', false],
  ])('%s / %s → %s', (name, category, anime) => {
    expect(looksLikeAnime(name, category)).toBe(anime);
  });
});
