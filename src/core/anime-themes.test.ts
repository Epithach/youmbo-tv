import { describe, expect, it } from 'vitest';
import { looksLikeAnime, pickOpening, searchTitle, type AnimeResult } from './anime-themes';

const theme = (link: string) => ({
  type: 'OP',
  animethemeentries: [{ videos: [{ audio: { link } }] }],
});

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

describe('pickOpening', () => {
  it('prend la N-ième saison TV dans l’ordre de diffusion', () => {
    const options = { title: 'Jujutsu Kaisen', kind: 'series' as const };
    expect(pickOpening(jujutsu, { ...options, season: 1 })).toBe('s1-op1');
    expect(pickOpening(jujutsu, { ...options, season: 2 })).toBe('s2-op1');
    expect(pickOpening(jujutsu, { ...options, season: 2, random: 0.9 })).toBe('s2-op2');
    expect(pickOpening(jujutsu, { ...options, season: 3 })).toBe('s3-op1');
    // Saison inconnue d'AnimeThemes : la dernière disponible.
    expect(pickOpening(jujutsu, { ...options, season: 7 })).toBe('s3-op1');
  });

  it('prend le film de la bonne année', () => {
    expect(pickOpening(jujutsu, { title: 'Jujutsu Kaisen', kind: 'movies', year: 2021 })).toBe(
      'film-op1',
    );
  });

  it('ne renvoie rien sans résultat', () => {
    expect(pickOpening([], { title: 'Inconnu', kind: 'series', season: 1 })).toBeUndefined();
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
