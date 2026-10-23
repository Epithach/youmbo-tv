/**
 * Réécrit les URLs d'un manifeste HLS en absolues par rapport à `baseUrl`
 * (l'URL finale du manifeste, après redirections).
 *
 * Derrière le proxy de dev, le navigateur voit le manifeste comme venant de
 * `localhost/proxy?...` : une URL relative y serait mal résolue. Une fois
 * absolues, chaque requête peut être re-proxifiée côté client.
 */
export function absolutizeHlsManifest(manifest: string, baseUrl: string): string {
  const resolve = (ref: string) => {
    try {
      return new URL(ref, baseUrl).href;
    } catch {
      return ref;
    }
  };

  return manifest
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === '') return line;
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_m, uri: string) => `URI="${resolve(uri)}"`);
      }
      return resolve(trimmed);
    })
    .join('\n');
}
