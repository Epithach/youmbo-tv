export type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

export interface PlayerEvents {
  onStateChange: (state: PlayerState, message?: string) => void;
}

/**
 * Lecteur abstrait : l'UI ne connaît que cette interface.
 * - `WebPlayer` : navigateur du PC (hls.js / mpegts.js), pour le dev.
 * - `TizenPlayer` (à venir) : lecteur natif AVPlay de la TV Samsung.
 */
export interface Player {
  play(url: string): void;
  stop(): void;
  destroy(): void;
  /** Films et séries : pause / reprise. */
  togglePause(): void;
  /** Avance (positif) ou recule (négatif), en secondes. */
  seekBy(seconds: number): void;
  /** Position et durée en secondes (durée 0 si inconnue, ex. direct). */
  position(): number;
  duration(): number;
  paused(): boolean;
}

export type StreamKind = 'hls' | 'mpegts' | 'native';

/** Devine le type de flux d'après l'URL. Les URLs Xtream sans extension sont du MPEG-TS. */
export function detectStreamKind(url: string): StreamKind {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = url.toLowerCase();
  }
  if (path.endsWith('.m3u8') || path.endsWith('.m3u')) return 'hls';
  if (/\.(mp4|m4v|webm|mkv|mov|mp3|aac)$/.test(path)) return 'native';
  return 'mpegts';
}
