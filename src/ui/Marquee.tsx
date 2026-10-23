import { createEffect, createSignal, onCleanup } from 'solid-js';

interface MarqueeProps {
  text: string;
  /** Défile seulement quand l'élément est sélectionné. */
  active: boolean;
  class?: string;
}

/** Vitesse de défilement, en pixels par seconde. */
const SPEED = 60;
/** Part du cycle d'animation passée à défiler à l'aller (voir @keyframes marquee). */
const SCROLL_SHARE = 0.3;

/**
 * Texte coupé par « … » au repos, qui défile quand il est sélectionné et
 * trop long pour sa place (comme sur les menus des TV).
 */
export function Marquee(props: MarqueeProps) {
  const [distance, setDistance] = createSignal(0);
  let outer: HTMLSpanElement | undefined;
  let inner: HTMLSpanElement | undefined;
  let frame = 0;

  createEffect(() => {
    // Relu à chaque changement de texte ou de sélection.
    void props.text;
    if (!props.active) return setDistance(0);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!outer || !inner) return;
      setDistance(Math.max(0, inner.scrollWidth - outer.clientWidth));
    });
  });
  onCleanup(() => cancelAnimationFrame(frame));

  const scrolling = () => props.active && distance() > 0;
  const duration = () => Math.max(4, distance() / SPEED / SCROLL_SHARE);

  return (
    <span
      ref={(el) => (outer = el)}
      class={`marquee ${props.class ?? ''}`}
      classList={{ 'marquee--scrolling': scrolling() }}
    >
      <span
        ref={(el) => (inner = el)}
        class="marquee__text"
        style={
          scrolling()
            ? {
                '--marquee-distance': `-${distance()}px`,
                'animation-duration': `${duration()}s`,
              }
            : {}
        }
      >
        {props.text}
      </span>
    </span>
  );
}
