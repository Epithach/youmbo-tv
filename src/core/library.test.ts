import { describe, expect, it } from 'vitest';
import type { CatalogItem } from './catalog';
import { channelKey, library, progressKey } from './library';
import type { Channel } from './m3u';

const movie = (id: number): CatalogItem => ({
  kind: 'movies',
  id,
  name: `Film ${id}`,
  categoryId: '1',
  genres: [],
  added: 0,
});
const series = (id: number): CatalogItem => ({ ...movie(id), kind: 'series', name: `Série ${id}` });

describe('favoris', () => {
  it('ajoute puis retire un film, sans le confondre avec une série de même id', () => {
    library.toggleFavorite(movie(1));
    expect(library.isFavorite(movie(1))).toBe(true);
    expect(library.isFavorite(series(1))).toBe(false);
    expect(library.favorites('movies').map((i) => i.id)).toEqual([1]);
    library.toggleFavorite(movie(1));
    expect(library.isFavorite(movie(1))).toBe(false);
  });

  it('identifie une chaîne par son id Xtream, sinon par son URL', () => {
    const tf1: Channel = { id: '0', name: 'TF1', url: 'http://x/1.ts', group: 'g', streamId: 7 };
    const m3u: Channel = { id: '0', name: 'TF1', url: 'http://x/1.ts', group: 'g' };
    expect(channelKey(tf1)).toBe('stream:7');
    expect(channelKey(m3u)).toBe('url:http://x/1.ts');
    library.toggleFavoriteChannel(tf1);
    expect(library.isFavoriteChannel({ ...tf1, id: '42' })).toBe(true); // position différente
    library.toggleFavoriteChannel(tf1);
    expect(library.isFavoriteChannel(tf1)).toBe(false);
  });
});

describe('reprise de lecture', () => {
  it('ne propose pas de reprendre au tout début', () => {
    library.saveProgress({
      key: progressKey('movie', 2),
      item: movie(2),
      position: 10,
      duration: 6000,
    });
    expect(library.resumePosition(progressKey('movie', 2))).toBeUndefined();
    expect(library.continueWatching('movies')).toEqual([]);
  });

  it('propose de reprendre un film entamé, puis l’oublie une fois fini', () => {
    const key = progressKey('movie', 3);
    library.saveProgress({ key, item: movie(3), position: 1200, duration: 6000 });
    expect(library.resumePosition(key)).toBe(1200);
    expect(library.continueWatching('movies').map((p) => p.item.id)).toEqual([3]);

    library.saveProgress({ key, item: movie(3), position: 5900, duration: 6000 });
    expect(library.resumePosition(key)).toBeUndefined();
    expect(library.continueWatching('movies')).toEqual([]);
  });

  it('garde une seule entrée par série : le dernier épisode regardé', () => {
    const show = series(9);
    library.saveProgress({
      key: progressKey('episode', 'a'),
      item: show,
      season: 0,
      episode: 1,
      position: 600,
      duration: 3000,
    });
    library.saveProgress({
      key: progressKey('episode', 'b'),
      item: show,
      season: 1,
      episode: 0,
      position: 300,
      duration: 3000,
    });
    expect(library.continueWatching('series')).toHaveLength(1);
    expect(library.continueWatching('series')[0].key).toBe('episode:b');
    expect(library.lastEpisode(9)).toEqual({ season: 1, episode: 0 });
  });
});
