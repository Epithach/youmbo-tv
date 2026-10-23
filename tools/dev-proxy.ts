import type { Plugin } from 'vite';
import { absolutizeHlsManifest } from './hls-rewrite.ts';
import { requestUpstream, resolveUserAgent } from './upstream.ts';

/**
 * Proxy du serveur de dev uniquement.
 *
 * Les serveurs IPTV n'envoient presque jamais d'en-têtes CORS : un navigateur
 * refuse donc de lire la playlist et les flux. En dev, on passe par
 * `/proxy?url=...`, que le serveur Vite (sur ta machine) va chercher lui-même.
 * Sur la TV, une app Tizen n'est pas soumise au CORS : le proxy n'existe pas.
 */

interface DevProxyOptions {
  /** Playlist pré-remplie, lue depuis M3U_URL dans `.env.local`. */
  defaultPlaylistUrl?: string;
  /** Nom (voir `USER_AGENTS`) ou User-Agent complet, via PROXY_USER_AGENT. */
  userAgent?: string;
}

export function devProxy({ defaultPlaylistUrl, userAgent }: DevProxyOptions = {}): Plugin {
  const resolvedUserAgent = resolveUserAgent(userAgent);

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
          const upstream = await requestUpstream(target, {
            userAgent: resolvedUserAgent,
            signal: abort.signal,
            range: req.headers.range,
          });
          res.statusCode = upstream.status;
          if (upstream.contentType) res.setHeader('Content-Type', upstream.contentType);
          // Films : le navigateur lit par morceaux (HTTP 206) pour pouvoir avancer et reculer.
          for (const header of ['content-length', 'content-range', 'accept-ranges']) {
            const value = upstream.headers[header];
            if (value) res.setHeader(header, value);
          }

          if (
            /mpegurl/i.test(upstream.contentType) ||
            /\.m3u8?$/i.test(new URL(upstream.url).pathname)
          ) {
            res.end(absolutizeHlsManifest(await upstream.text(), upstream.url));
            return;
          }

          upstream.body.on('error', () => res.destroy()).pipe(res);
        } catch (error) {
          if (abort.signal.aborted) return;
          res.statusCode = 502;
          res.end(`Échec du proxy : ${(error as Error).message}`);
        }
      });
    },
  };
}
