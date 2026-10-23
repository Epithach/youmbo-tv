/**
 * Diagnostic d'une playlist refusée par le fournisseur.
 *
 *   npm run diagnose -- "http://ton-fournisseur/get.php?..."
 *   (ou sans argument : lit M3U_URL dans .env.local)
 *
 * Essaie plusieurs User-Agent de lecteurs IPTV connus et affiche, pour chacun,
 * le code HTTP et si la réponse ressemble à une playlist. Le lien et le
 * contenu de la playlist ne sont jamais affichés (ils contiennent tes identifiants).
 */
import { readFileSync } from 'node:fs';
import { USER_AGENTS, requestUpstream } from './upstream.ts';

function readUrl(): string | undefined {
  if (process.argv[2]) return process.argv[2];
  try {
    const env = readFileSync('.env.local', 'utf8');
    return /^M3U_URL=(.+)$/m.exec(env)?.[1].trim();
  } catch {
    return undefined;
  }
}

const url = readUrl();
if (!url) {
  console.error('Donne le lien en argument : npm run diagnose -- "http://..."');
  process.exit(1);
}

/** Masque les identifiants si le fournisseur les recopie dans son message d'erreur. */
function redact(text: string, source: string): string {
  const parsed = new URL(source);
  const secrets = [...parsed.searchParams.values(), ...parsed.pathname.split('/')].filter(
    (value) => value.length >= 3,
  );
  return secrets.reduce((result, secret) => result.split(secret).join('***'), text);
}

console.log(`Hôte testé : ${new URL(url).host}\n`);

for (const [label, userAgent] of Object.entries(USER_AGENTS)) {
  try {
    const response = await requestUpstream(url, { userAgent });
    const body = await response.text(4096);
    const isPlaylist = body.trimStart().startsWith('#EXTM3U');
    const verdict = isPlaylist
      ? 'OK, playlist reçue'
      : `refusé : ${redact(body.replace(/\s+/g, ' ').slice(0, 120), url) || '(réponse vide)'}`;
    console.log(`${label.padEnd(14)} HTTP ${response.status}  ${verdict}`);
  } catch (error) {
    console.log(`${label.padEnd(14)} erreur réseau : ${(error as Error).message}`);
  }
}
