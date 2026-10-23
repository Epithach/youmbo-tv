import { describe, expect, it } from 'vitest';
import { mergeItems } from './catalog-rows';
import type { CatalogItem } from './vod';

const item = (id: number, added: number): CatalogItem => ({
  kind: 'series',
  id,
  name: `s${id}`,
  categoryId: '1',
  genres: [],
  added,
});

describe('mergeItems', () => {
  it('supprime les doublons et met les plus récents en premier', () => {
    const merged = mergeItems([
      [item(1, 10), item(2, 30)],
      [item(2, 30), item(3, 20)],
    ]);
    expect(merged.map((i) => i.id)).toEqual([2, 3, 1]);
  });
});
