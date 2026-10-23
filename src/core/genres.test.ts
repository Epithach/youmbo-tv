import { describe, expect, it } from 'vitest';
import { genresIn, isRecentCategory } from './genres';

describe('genresIn', () => {
  it.each([
    // Champ « genre » des séries
    ['Drame, Comédie', ['comedy', 'drama']],
    ['Animation, Action & Adventure', ['action', 'animation']],
    ['Crime, Mystère', ['crime']],
    ['Science-Fiction & Fantastique', ['scifi']],
    ['War & Politics', ['war']],
    ['Kids', ['kids']],
    // Noms de catégories de films
    ['VOD - CRIME-THRILLER [FR]', ['crime']],
    ['VOD - ANIME [FR]', ['animation']],
    ['VOD - COMEDIE [FR]', ['comedy']],
    ['VOD - HORREUR [FR]', ['horror']],
    ['SRS - NETFLIX KIDS [FR]', ['kids']],
    ['SRS - MANGA [FR]', ['animation']],
    // Pas un genre
    ['VOD - NETFLIX [FR]', []],
    ['VOD - RÉCEMMENT AJOUTER [FR]', []],
    ['', []],
  ])('%s → %j', (text, keys) => {
    expect(genresIn(text)).toEqual(keys);
  });

  it('ne confond pas un mot-clé avec un morceau de mot', () => {
    expect(genresIn('Warner Bros')).toEqual([]); // pas WAR
    expect(genresIn('Dramatique')).toEqual([]); // pas DRAMA
  });
});

describe('isRecentCategory', () => {
  it.each([
    ['VOD - RÉCEMMENT AJOUTER [FR]', true],
    ['SRS - SERIES 2026 [FR]', true],
    ['VOD - ACTION [FR]', false],
    ['SRS - NETFLIX [FR]', false],
  ])('%s → %s', (name, recent) => {
    expect(isRecentCategory(name)).toBe(recent);
  });
});
