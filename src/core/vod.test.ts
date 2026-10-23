import { describe, expect, it } from 'vitest';
import { ALL_COUNTRIES } from './country';
import {
  categoriesForCountry,
  categoryLanguage,
  displayCategoryName,
  displayTitle,
  movieUrl,
  resizePoster,
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
