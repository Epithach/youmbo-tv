import { describe, expect, it } from 'vitest';
import { matchScore, search } from './search';

describe('matchScore', () => {
  it.each([
    ['FR - TF1 FHD', 'tf1', 2],
    ['Le Seigneur des Anneaux', 'le seigneur', 3],
    ['Le Seigneur des Anneaux', 'anneaux', 2],
    ['Le Seigneur des Anneaux', 'seigneur anneaux', 2],
    ['Les Misérables', 'miserables', 2],
    ['Interstellar', 'stella', 1],
    ['Interstellar', 'matrix', 0],
    ['Interstellar', '   ', 0],
  ])('%s / « %s » → %i', (title, query, score) => {
    expect(matchScore(title, query)).toBe(score);
  });
});

describe('search', () => {
  const titles = ['Interstellar', 'Star Wars', 'A Star Is Born', 'Stargate', 'Lone Star'];

  it('classe les débuts de titre en premier, puis garde l’ordre d’origine (Interstellar ne contient pas « star »)', () => {
    expect(search(titles, 'star', (t) => t, 10)).toEqual([
      'Star Wars',
      'Stargate',
      'A Star Is Born',
      'Lone Star',
    ]);
  });

  it('limite le nombre de résultats', () => {
    expect(search(titles, 'star', (t) => t, 2)).toEqual(['Star Wars', 'Stargate']);
  });
});
