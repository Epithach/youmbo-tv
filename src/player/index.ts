import type { Player, PlayerEvents } from './types';
import { WebPlayer } from './web-player';

export type { Player, PlayerEvents, PlayerState } from './types';

/** Choisit l'implémentation selon la plateforme (AVPlay sur Tizen viendra ici). */
export function createPlayer(video: HTMLVideoElement, events: PlayerEvents): Player {
  return new WebPlayer(video, events);
}
