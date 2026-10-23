export type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

export type TrackType = 'audio' | 'subtitle';

/** Une piste audio ou de sous-titres proposée dans le lecteur. */
export interface TrackOption {
  id: string;
  type: TrackType;
  label: string;
  selected: boolean;
}

export interface TrackList {
  options: TrackOption[];
  /**
   * Le lecteur sait-il changer de piste ? Le navigateur du PC ne sait pas le
   * faire dans un MKV (la TV oui) : on montre alors les pistes sans les activer.
   */
  switchable: boolean;
}

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
  /** Volume entre 0 et 1. */
  volume(): number;
  setVolume(volume: number): void;
  /** Pistes audio et sous-titres du média en cours. */
  tracks(): Promise<TrackList>;
  /** `null` pour les sous-titres : les désactiver. */
  selectTrack(type: TrackType, id: string | null): void;
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
