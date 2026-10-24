import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  epgFor,
  liveCategories,
  liveStreams,
  movieInfo,
  series,
  seriesCategories,
  seriesInfo,
  vodCategories,
  vodStreams,
} from './catalog.ts';

/**
 * Faux serveur Xtream, servi par Vite en mode `mock` (`npm run dev:mock`).
 *
 * Il répond comme un vrai panel (`/player_api.php`, `/live/…`, `/movie/…`,
 * `/series/…`) avec le catalogue fictif de `catalog.ts`, pour développer et
 * tester sans dépendre d'un fournisseur (ni risquer de se faire bannir).
 */

/** Vidéo libre de droits (bande-annonce de Sintel, Blender Foundation) pour les films. */
const SAMPLE_MOVIE = 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4';
/** Flux HLS de test (Mux) dont on enchaîne les segments MPEG-TS pour simuler le direct. */
const SAMPLE_LIVE_PLAYLIST =
  'https://test-streams.mux.dev/x36xhzz/url_2/193039199_mp4_h264_aac_ld_7.m3u8';

function sendJson(res: ServerResponse, body: unknown) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function api(params: URLSearchParams): unknown {
  const categoryId = params.get('category_id');
  const inCategory = <T extends { category_id: string }>(list: T[]) =>
    categoryId ? list.filter((item) => item.category_id === categoryId) : list;

  switch (params.get('action')) {
    case null:
      return {
        user_info: {
          auth: 1,
          status: 'Active',
          exp_date: String(Math.floor(Date.now() / 1000) + 365 * 86400),
          max_connections: '1',
          active_cons: '0',
        },
        server_info: { url: 'localhost', timezone: 'Europe/Paris' },
      };
    case 'get_live_categories':
      return liveCategories;
    case 'get_live_streams':
      return inCategory(liveStreams);
    case 'get_vod_categories':
      return vodCategories;
    case 'get_vod_streams':
      return inCategory(vodStreams);
    case 'get_series_categories':
      return seriesCategories;
    case 'get_series':
      return inCategory(series);
    case 'get_vod_info': {
      const movie = vodStreams.find((m) => m.stream_id === Number(params.get('vod_id')));
      return movie ? movieInfo(movie) : { info: {}, movie_data: {} };
    }
    case 'get_series_info': {
      const show = series.find((s) => s.series_id === Number(params.get('series_id')));
      return show ? seriesInfo(show) : { info: {}, episodes: {} };
    }
    case 'get_simple_data_table': {
      // Guide de la journée : 6 h passées (replay) et 6 h à venir.
      const now = Math.floor(Date.now() / 1000);
      return { epg_listings: epgFor(Number(params.get('stream_id')), now, 24, 12) };
    }
    case 'get_short_epg': {
      const limit = Number(params.get('limit')) || 4;
      const now = Math.floor(Date.now() / 1000);
      return { epg_listings: epgFor(Number(params.get('stream_id')), now, limit) };
    }
    default:
      return [];
  }
}

/** Affiche ou logo : un rectangle coloré avec un numéro, sans image externe. */
function image(res: ServerResponse, name: string) {
  const id = Number(name.match(/(\d+)/)?.[1] ?? 0);
  const hue = (id * 47) % 360;
  const wide = name.startsWith('backdrop');
  const [w, h] = wide ? [1280, 720] : name.startsWith('logo') ? [96, 72] : [342, 513];
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'max-age=86400');
  res.end(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect width="100%" height="100%" fill="hsl(${hue},55%,35%)"/>` +
      `<text x="50%" y="55%" fill="#fff" font-family="sans-serif" font-size="${h / 6}" ` +
      `text-anchor="middle">${id}</text></svg>`,
  );
}

/** Direct simulé : les segments MPEG-TS d'un flux HLS de test, enchaînés en boucle. */
async function live(req: IncomingMessage, res: ServerResponse) {
  const lines = (await (await fetch(SAMPLE_LIVE_PLAYLIST)).text()).split('\n');
  const segments: { url: string; seconds: number }[] = [];
  let seconds = 10;
  for (const line of lines) {
    const duration = /^#EXTINF:([\d.]+)/.exec(line)?.[1];
    if (duration) seconds = Number(duration);
    else if (line && !line.startsWith('#')) {
      segments.push({ url: new URL(line, SAMPLE_LIVE_PLAYLIST).href, seconds });
    }
  }

  let open = true;
  req.on('close', () => (open = false));
  res.setHeader('Content-Type', 'video/mp2t');
  // Comme un vrai direct : une petite avance au départ, puis au rythme de la lecture.
  const AHEAD = 2;
  for (let i = 0, sent = 0; open; i = (i + 1) % segments.length, sent++) {
    const segment = await fetch(segments[i].url);
    if (!open) break;
    res.write(Buffer.from(await segment.arrayBuffer()));
    if (sent >= AHEAD)
      await new Promise((resolve) => setTimeout(resolve, segments[i].seconds * 1000));
  }
  res.end();
}

export function mockXtream(): Plugin {
  return {
    name: 'youmbo:mock-xtream',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = url.pathname;

        if (path === '/player_api.php') return sendJson(res, api(url.searchParams));
        if (path.startsWith('/mock-image/')) return image(res, path.slice('/mock-image/'.length));
        if (path.startsWith('/live/') || path.startsWith('/timeshift/')) {
          live(req, res).catch(() => res.destroy());
          return;
        }
        if (path.startsWith('/movie/') || path.startsWith('/series/')) {
          res.writeHead(302, { Location: SAMPLE_MOVIE });
          res.end();
          return;
        }
        next();
      });
    },
  };
}
