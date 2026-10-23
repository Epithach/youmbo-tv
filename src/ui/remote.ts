import { createSignal, onCleanup, onMount } from 'solid-js';
import { toRemoteKey, type RemoteKey } from './keys';

/**
 * Écoute la télécommande (ou le clavier) tant que l'écran est affiché.
 * Dans un champ de texte, seules Échap et la touche Retour de la télécommande
 * comptent : les flèches et Retour arrière servent à la saisie.
 */
export function useRemote(handler: (key: RemoteKey) => void) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) {
      if (event.keyCode === 27 || event.keyCode === 10009) handler('back');
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
