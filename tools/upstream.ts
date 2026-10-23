import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';

/**
 * User-Agent de lecteurs IPTV connus. Beaucoup de fournisseurs n'acceptent
 * que certains lecteurs et renvoient sinon un code maison (403, 884…).
 */
export const USER_AGENTS = {
  vlc: 'VLC/3.0.21 LibVLC/3.0.21',
  tivimate: 'TiviMate/5.1.6 (Android 11)',
  smarters: 'IPTVSmartersPro',
  okhttp: 'okhttp/4.12.0',
  chrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  tizen:
    'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36',
  aucun: '',
} as const;

export type UserAgentName = keyof typeof USER_AGENTS;

/** Accepte un nom de la liste ci-dessus ou un User-Agent complet. */
export function resolveUserAgent(value: string | undefined): string {
  if (!value) return USER_AGENTS.vlc;
  return value in USER_AGENTS ? USER_AGENTS[value as UserAgentName] : value;
}

export interface UpstreamResponse {
  status: number;
  contentType: string;
  /** URL finale, après redirections. */
  url: string;
  body: IncomingMessage;
  /** Lit le corps en texte (jusqu'à `limit` octets si précisé). */
  text(limit?: number): Promise<string>;
}

interface RequestOptions {
  userAgent: string;
  signal?: AbortSignal;
  maxRedirects?: number;
}

/**
 * Requête GET minimale via `node:http(s)`. On n'utilise pas `fetch` : il
 * ajoute des en-têtes de navigateur (`sec-fetch-mode`, `accept-language`…)
 * que certains fournisseurs IPTV rejettent.
 */
export function requestUpstream(
  url: string,
  { userAgent, signal, maxRedirects = 5 }: RequestOptions,
): Promise<UpstreamResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const headers: Record<string, string> = { Accept: '*/*' };
    if (userAgent) headers['User-Agent'] = userAgent;

    const request = client.get(target, { headers, signal }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;

      if (status >= 300 && status < 400 && location) {
        response.resume();
        if (maxRedirects === 0) return reject(new Error('Trop de redirections'));
        requestUpstream(new URL(location, target).href, {
          userAgent,
          signal,
          maxRedirects: maxRedirects - 1,
        }).then(resolve, reject);
        return;
      }

      resolve({
        status,
        contentType: response.headers['content-type'] ?? '',
        url: target.href,
        body: response,
        text: (limit) => readText(response, limit),
      });
    });
    request.on('error', reject);
  });
}

function readText(stream: IncomingMessage, limit = Infinity): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= limit) stream.destroy();
    });
    const done = () => resolve(Buffer.concat(chunks).toString('utf8'));
    stream.on('end', done);
    stream.on('close', done);
    stream.on('error', reject);
  });
}
