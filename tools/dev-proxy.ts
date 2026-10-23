import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { Plugin } from 'vite';
import { absolutizeHlsManifest } from './hls-rewrite.ts';

/**
 * Proxy du serveur de dev uniquement.
 *
 * Les serveurs IPTV n'envoient presque jamais d'en-têtes CORS : un navigateur
 * refuse donc de lire la playlist et les flux. En dev, on passe par
 * `/proxy?url=...`, que le serveur Vite (sur ta machine) va chercher lui-même.
 * Sur la TV, une app Tizen n'est pas soumise au CORS : le proxy n'existe pas.
 */

// Beaucoup de fournisseurs filtrent sur le User-Agent et acceptent celui de VLC.
const USER_AGENT = 'VLC/3.0.21 LibVLC/3.0.21';

interface DevProxyOptions {
  /** Playlist pré-remplie, lue depuis M3U_URL dans `.env.local`. */
  defaultPlaylistUrl?: string;
}

export function devProxy({ defaultPlaylistUrl }: DevProxyOptions = {}): Plugin {
  return {
    name: 'youmbo:dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev/config', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ playlistUrl: defaultPlaylistUrl ?? null }));
      });

      server.middlewares.use('/proxy', async (req, res) => {
        const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url');
        if (!target || !/^https?:\/\//i.test(target)) {
          res.statusCode = 400;
          res.end('Paramètre url manquant ou invalide');
          return;
        }

        const abort = new AbortController();
        res.on('close', () => abort.abort());

        try {
          const upstream = await fetch(target, {
            headers: { 'User-Agent': USER_AGENT },
            redirect: 'follow',
            signal: abort.signal,
          });
          res.statusCode = upstream.status;
          const contentType = upstream.headers.get('content-type') ?? '';
          if (contentType) res.setHeader('Content-Type', contentType);

          if (
            /mpegurl/i.test(contentType) ||
            /\.m3u8?(\?|$)/i.test(new URL(upstream.url).pathname)
          ) {
            res.end(absolutizeHlsManifest(await upstream.text(), upstream.url));
            return;
          }

          if (!upstream.body) {
            res.end();
            return;
          }
          Readable.fromWeb(upstream.body as NodeReadableStream)
            .on('error', () => res.destroy())
            .pipe(res);
        } catch (error) {
          if (abort.signal.aborted) return;
          res.statusCode = 502;
          res.end(`Échec du proxy : ${(error as Error).message}`);
        }
      });
    },
  };
}
