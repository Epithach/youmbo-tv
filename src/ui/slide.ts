import { createEffect, on } from 'solid-js';

/** Durée et courbe des glissements : rapides, avec une fin douce. */
export const SLIDE_MS = 260;
export const SLIDE_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * Glissement d'une rangée « fenêtrée » (seuls quelques éléments sont rendus
 * autour de la sélection) : quand le premier élément rendu change, la
 * rangée repart de son ancienne position et glisse jusqu'à la nouvelle,
 * au lieu de sauter d'un coup.
 *
 * S'utilise comme `ref` du conteneur : `ref={slideOnShift(() => start(), '.poster')}`,
 * `item` désignant les éléments de la rangée (pas les flèches ou autres décors).
 */
export function slideOnShift(start: () => number, item: string) {
  return (container: HTMLElement) => {
    createEffect(
      on(
        start,
        (current, previous) => {
          const delta = current - (previous ?? current);
          const first = container.querySelector<HTMLElement>(item);
          if (!delta || !first || typeof container.animate !== 'function') return;
          const style = getComputedStyle(first);
          const step =
            first.offsetWidth + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
          // Au-delà de quelques crans (saut, souris), pas de glissement.
          if (Math.abs(delta) > 3) return;
          container.animate(
            [{ transform: `translateX(${delta * step}px)` }, { transform: 'translateX(0)' }],
            { duration: SLIDE_MS, easing: SLIDE_EASING },
          );
        },
        { defer: true },
      ),
    );
  };
}
