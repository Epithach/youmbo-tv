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

// Pause entre deux essais : les fournisseurs limitent souvent le débit (HTTP 429).
const PAUSE_MS = 2000;
const pause = () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS));

const target = new URL(url);
console.log(`Hôte testé : ${target.host}\n`);

// 1. Lien Xtream : on interroge l'état du compte, c'est ce que l'app utilisera.
const username = target.searchParams.get('username');
const password = target.searchParams.get('password');
if (/\/(get|player_api)\.php$/i.test(target.pathname) && username && password) {
  const api = `${target.origin}/player_api.php?${new URLSearchParams({ username, password })}`;
  try {
    const response = await requestUpstream(api, { userAgent: USER_AGENTS.vlc });
    const info = JSON.parse(await response.text()).user_info ?? {};
    const expires = info.exp_date
      ? new Date(Number(info.exp_date) * 1000).toLocaleDateString('fr-FR')
      : 'inconnue';
    console.log('Compte Xtream (API utilisée par l’app) :');
    console.log(
      `  authentifié : ${info.auth === 1 ? 'oui' : 'non'}, statut : ${info.status ?? '?'}`,
    );
    console.log(`  expiration : ${expires}`);
    console.log(`  connexions : ${info.active_cons ?? '?'} / ${info.max_connections ?? '?'}\n`);
  } catch (error) {
    console.log(`API Xtream injoignable : ${(error as Error).message}\n`);
  }
  await pause();
}

// 2. Téléchargement direct de la playlist avec différents lecteurs.
console.log('Téléchargement direct de la playlist :');
for (const [label, userAgent] of Object.entries(USER_AGENTS)) {
  try {
    const response = await requestUpstream(url, { userAgent });
    const body = await response.text(4096);
    const isPlaylist = body.trimStart().startsWith('#EXTM3U');
    const verdict = isPlaylist
      ? 'OK, playlist reçue'
      : `refusé : ${redact(body.replace(/\s+/g, ' ').slice(0, 120), url) || '(réponse vide)'}`;
    console.log(`  ${label.padEnd(12)} HTTP ${response.status}  ${verdict}`);
    if (response.status === 429) {
      console.log(
        '  Le fournisseur limite le nombre de requêtes : réessaie dans quelques minutes.',
      );
      break;
    }
  } catch (error) {
    console.log(`  ${label.padEnd(12)} erreur réseau : ${(error as Error).message}`);
  }
  await pause();
}
