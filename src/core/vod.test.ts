import { describe, expect, it } from 'vitest';
import { ALL_COUNTRIES } from './country';
import {
  categoriesForCountry,
  categoryLanguage,
  displayCategoryName,
  displayEpisodeTitle,
  displayTitle,
  episodeUrl,
  movieUrl,
  resizePoster,
  seasonsOf,
  type SeriesEpisode,
} from './vod';

const categories = [
  'VOD - RÉCEMMENT AJOUTER [FR]',
  'VOD - ACTION [EN]',
  'VOD - ACTION [FR]',
  'VOD - FRENCH 4K',
  'VOD - DRAMA [MULTISUB]',
  'VOD - CINEMA [DE]',
  'SRS - NETFLIX [QC]',
  'VOD - 4K',
].map((category_name, i) => ({ category_id: String(i), category_name }));

const names = (list: { category_name: string }[]) => list.map((c) => c.category_name);

describe('categoryLanguage', () => {
  it.each([
    ['VOD - ACTION [FR]', 'FR'],
    ['SRS - NETFLIX [qc]', 'QC'],
    ['VOD - FRENCH 4K', 'FR'],
    ['VOD - 4K', undefined],
  ])('%s → %s', (name, language) => {
    expect(categoryLanguage(name)).toBe(language);
  });
});

describe('categoriesForCountry', () => {
  it('ne garde que la langue du pays, dans l’ordre du fournisseur', () => {
    expect(names(categoriesForCountry(categories, 'FR'))).toEqual([
      'VOD - RÉCEMMENT AJOUTER [FR]',
      'VOD - ACTION [FR]',
      'VOD - FRENCH 4K',
    ]);
  });

  it('accepte plusieurs langues pour un pays', () => {
    expect(names(categoriesForCountry(categories, 'CA'))).toEqual([
      'VOD - RÉCEMMENT AJOUTER [FR]',
      'VOD - ACTION [EN]',
      'VOD - ACTION [FR]',
      'VOD - FRENCH 4K',
      'SRS - NETFLIX [QC]',
    ]);
  });

  it('se rabat sur l’anglais sans catalogue dans la langue', () => {
    expect(names(categoriesForCountry(categories, 'SE'))).toEqual([
      'VOD - ACTION [EN]',
      'VOD - DRAMA [MULTISUB]',
    ]);
  });

  it('montre tout pour « Tous les pays »', () => {
    expect(categoriesForCountry(categories, ALL_COUNTRIES)).toHaveLength(categories.length);
  });
});

describe('affichage', () => {
  it.each([
    ['VOD - ACTION [FR]', 'Action'],
    ['VOD - CRIME-THRILLER [FR]', 'Crime-Thriller'],
    ['VOD - FILMOGRAPHIE LOUIS DE FUNES [FR]', 'Filmographie Louis De Funes'],
    ['SRS - DISNEY+ KIDS [FR]', 'Disney+ Kids'],
  ])('catégorie %s → %s', (name, shown) => {
    expect(displayCategoryName(name)).toBe(shown);
  });

  it('retire le préfixe de langue des titres', () => {
    expect(displayTitle('FR - The Fall (2008)')).toBe('The Fall (2008)');
    expect(displayTitle('Matrix')).toBe('Matrix');
  });

  it('redimensionne les affiches TMDB', () => {
    expect(resizePoster('https://image.tmdb.org/t/p/w600_and_h900_bestv2/abc.jpg', 185)).toBe(
      'https://image.tmdb.org/t/p/w185/abc.jpg',
    );
    expect(resizePoster('http://autre.cdn/poster.jpg', 185)).toBe('http://autre.cdn/poster.jpg');
    expect(resizePoster(undefined, 185)).toBeUndefined();
  });

  it('construit l’URL de lecture d’un film', () => {
    const credentials = { server: 'http://x.tv:80', username: 'u', password: 'p w' };
    expect(movieUrl(credentials, 42, 'mkv')).toBe('http://x.tv:80/movie/u/p%20w/42.mkv');
  });
});

describe('séries', () => {
  const episode = (id: string, num: number, title: string): SeriesEpisode => ({
    id,
    episode_num: num,
    title,
    container_extension: 'mkv',
  });

  it('trie les saisons et les épisodes, et ignore les saisons vides', () => {
    const seasons = seasonsOf({
      info: {},
      episodes: {
        '2': [episode('21', 2, 'b'), episode('20', 1, 'a')],
        '1': [episode('10', 1, 'x')],
        '3': [],
      },
    });
    expect(seasons.map((s) => s.number)).toEqual([1, 2]);
    expect(seasons[1].episodes.map((e) => e.id)).toEqual(['20', '21']);
  });

  it('accepte les épisodes sous forme de tableau de saisons', () => {
    const seasons = seasonsOf({
      info: {},
      episodes: [[episode('1', 1, 'a')], [episode('2', 1, 'b')]],
    });
    expect(seasons.map((s) => s.number)).toEqual([1, 2]);
  });

  it('extrait le titre de l’épisode', () => {
    expect(
      displayEpisodeTitle(episode('1', 1, 'FR - Seven Seconds (2018) (US) - S01E01 - Pilote')),
    ).toBe('Pilote');
    expect(displayEpisodeTitle(episode('1', 3, 'FR - Série - S01E03'))).toBe('Épisode 3');
  });

  it('construit l’URL de lecture d’un épisode', () => {
    const credentials = { server: 'http://x.tv:80', username: 'u', password: 'p' };
    expect(episodeUrl(credentials, episode('1411623', 1, 't'))).toBe(
      'http://x.tv:80/series/u/p/1411623.mkv',
    );
  });
});

describe('noms de catégories traduits', () => {
  it.each([
    ['VOD - OTHERS [FR]', 'Autres'],
    ['VOD - RÉCEMMENT AJOUTER [FR]', 'Récemment ajoutés'],
    ['SRS - SERIES 2026 [FR]', 'Séries 2026'],
  ])('%s → %s', (name, shown) => {
    expect(displayCategoryName(name)).toBe(shown);
  });
});
