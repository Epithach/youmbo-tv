import type { TrackOption } from '../player/types';
import { loadJson, saveJson } from './storage';

/**
 * Préférences de lecture des films et séries : langue audio et sous-titres
 * choisis d'office au lancement, quand le lecteur sait changer de piste (TV).
 */

export type SubtitleMode = 'off' | 'forced' | 'always';

export interface PlaybackPreferences {
  /** Code ISO à deux lettres (« fr »), ou « original » pour garder la piste du fichier. */
  audioLanguage: string;
  subtitles: SubtitleMode;
}

export const AUDIO_LANGUAGES: { code: string; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'Anglais' },
  { code: 'es', label: 'Espagnol' },
  { code: 'de', label: 'Allemand' },
  { code: 'it', label: 'Italien' },
  { code: 'pt', label: 'Portugais' },
  { code: 'nl', label: 'Néerlandais' },
  { code: 'ar', label: 'Arabe' },
  { code: 'original', label: 'Version originale' },
];

export const SUBTITLE_MODES: { mode: SubtitleMode; label: string }[] = [
  { mode: 'forced', label: 'Forcés seulement' },
  { mode: 'always', label: 'Toujours' },
  { mode: 'off', label: 'Désactivés' },
];

const STORAGE_KEY = 'youmbo.playback';

/** Codes ISO 639-2 (sur trois lettres) des langues courantes, vers leur code à deux lettres. */
const THREE_LETTERS: Record<string, string> = {
  fre: 'fr',
  fra: 'fr',
  eng: 'en',
  spa: 'es',
  ger: 'de',
  deu: 'de',
  ita: 'it',
  por: 'pt',
  dut: 'nl',
  nld: 'nl',
  ara: 'ar',
};

/** « fre », « fra », « fr-CA » → « fr ». */
export function baseLanguage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const base = code.toLowerCase().split('-')[0];
  return THREE_LETTERS[base] ?? base;
}

/** Langue audio par défaut selon le pays choisi (FR → français…). */
export function defaultPreferences(country: string): PlaybackPreferences {
  const byCountry: Record<string, string> = {
    FR: 'fr',
    BE: 'fr',
    CH: 'fr',
    CA: 'fr',
    GB: 'en',
    US: 'en',
    ES: 'es',
    DE: 'de',
    IT: 'it',
    PT: 'pt',
    NL: 'nl',
  };
  return { audioLanguage: byCountry[country] ?? 'original', subtitles: 'forced' };
}

export function loadPreferences(country: string): PlaybackPreferences {
  return {
    ...defaultPreferences(country),
    ...loadJson<Partial<PlaybackPreferences>>(STORAGE_KEY, {}),
  };
}

export const savePreferences = (preferences: PlaybackPreferences) =>
  saveJson(STORAGE_KEY, preferences);

/** L'audiodescription (pour les malvoyants) n'est jamais choisie d'office. */
const isAudioDescription = (track: TrackOption) =>
  /audio[- ]?description|\bAD\b/i.test(track.label);

/**
 * Pistes à activer selon les préférences : \`audio\` absent = garder celle du
 * fichier ; \`subtitle\` à \`null\` = sans sous-titres.
 */
export function pickTracks(
  options: readonly TrackOption[],
  preferences: PlaybackPreferences,
): { audio?: string; subtitle: string | null } {
  const wanted = preferences.audioLanguage;
  const inLanguage = (track: TrackOption) => baseLanguage(track.language) === wanted;

  const audio =
    wanted === 'original'
      ? undefined
      : options.find((t) => t.type === 'audio' && inLanguage(t) && !isAudioDescription(t))?.id;

  const subtitles = options.filter((t) => t.type === 'subtitle');
  // Langue des sous-titres : celle de la préférence, ou le français en VO.
  const subtitleLanguage = wanted === 'original' ? 'fr' : wanted;
  const matching = subtitles.filter((t) => baseLanguage(t.language) === subtitleLanguage);
  let subtitle: string | null = null;
  if (preferences.subtitles === 'forced') subtitle = matching.find((t) => t.forced)?.id ?? null;
  if (preferences.subtitles === 'always') {
    subtitle = (matching.find((t) => !t.forced) ?? matching[0])?.id ?? null;
  }
  return { audio, subtitle };
}
