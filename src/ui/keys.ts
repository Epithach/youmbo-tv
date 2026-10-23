/** Touches communes au clavier du PC et à la télécommande Samsung. */
export type RemoteKey = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';

const KEY_CODES: Record<number, RemoteKey> = {
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  13: 'ok',
  8: 'back', // Retour arrière (PC)
  27: 'back', // Échap (PC)
  10009: 'back', // Touche Retour de la télécommande Tizen
};

export function toRemoteKey(event: KeyboardEvent): RemoteKey | undefined {
  // keyCode est obsolète mais c'est ce que les TV Tizen anciennes remontent de façon fiable.
  return KEY_CODES[event.keyCode];
}
