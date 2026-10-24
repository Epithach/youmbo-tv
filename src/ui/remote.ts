import { createSignal, onCleanup, onMount } from 'solid-js';

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

function toRemoteKey(event: KeyboardEvent): RemoteKey | undefined {
  // keyCode est obsolète mais c'est ce que les TV Tizen anciennes remontent de façon fiable.
  return KEY_CODES[event.keyCode];
}

/**
 * Écoute la télécommande (ou le clavier) tant que l'écran est affiché.
 * Dans un champ de texte, seules Échap et la touche Retour de la télécommande
 * comptent : les flèches et Retour arrière servent à la saisie.
 */
export function useRemote(handler: (key: RemoteKey) => void) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) {
      // ↑ ↓ ne servent pas à la saisie : on les laisse sortir du champ (recherche).
      const key = event.keyCode === 38 ? 'up' : event.keyCode === 40 ? 'down' : undefined;
      if (event.keyCode === 27 || event.keyCode === 10009) handler('back');
      else if (key) {
        event.preventDefault();
        handler(key);
      }
      return;
    }
    const key = toRemoteKey(event);
    if (!key) return;
    event.preventDefault();
    handler(key);
  };
  onMount(() => document.addEventListener('keydown', onKeyDown));
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Sélection dans une liste de boutons, pilotée par la télécommande. */
export function createSelection(count: () => number, initial = 0) {
  const [index, setIndex] = createSignal(initial);
  const move = (delta: number) => setIndex(clamp(index() + delta, 0, count() - 1));
  return { index, setIndex, move };
}

/**
 * Vrai déplacement de la souris ? Chrome émet aussi des mouvements « fantômes »
 * quand la page change sous un curseur immobile : on compare les positions.
 */
let lastPointer = { x: -1, y: -1 };
export function pointerMoved(event: MouseEvent): boolean {
  const moved = event.clientX !== lastPointer.x || event.clientY !== lastPointer.y;
  lastPointer = { x: event.clientX, y: event.clientY };
  return moved;
}
