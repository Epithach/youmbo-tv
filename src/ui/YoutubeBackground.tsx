import { createSignal, onCleanup } from 'solid-js';

/** Après le début de la lecture, le lecteur YouTube garde ses boutons affichés un moment. */
const SETTLE_MS = 2500;
/** Sans nouvelles du lecteur (API bloquée…), la vidéo apparaît quand même. */
const FALLBACK_MS = 9000;
/** Montée du son, en même temps que le fondu de l'image. */
const FADE_MS = 1500;
const FADE_STEPS = 15;
const CHECK_MS = 250;

/** Lecteur YouTube sans cookies, muet au départ, sans commandes, en boucle, pilotable. */
export const youtubeUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` +
  `?autoplay=1&mute=1&controls=0&loop=1&playlist=${encodeURIComponent(id)}` +
  '&modestbranding=1&rel=0&playsinline=1&disablekb=1&enablejsapi=1';

interface YoutubeBackgroundProps {
  id: string;
  /** Classe de l'iframe ; `<classe>--ready` est ajoutée à l'apparition. */
  class: string;
  title: string;
  /** Volume visé, de 0 à 1. */
  volume: number;
  /** Délai minimal avant l'apparition, depuis le lancement. */
  revealAfterMs: number;
}

/** Messages envoyés par le lecteur YouTube : « joue » quand l'état vaut 1. */
function isPlayingMessage(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  try {
    const message = JSON.parse(data) as { event?: string; info?: unknown };
    const info = message.info as { playerState?: number } | number | undefined;
    return (
      (message.event === 'onStateChange' && info === 1) ||
      (typeof info === 'object' && info?.playerState === 1)
    );
  } catch {
    return false;
  }
}

/**
 * Bande-annonce YouTube en fond : lancée muette et invisible, elle n'apparaît
 * qu'une fois le lecteur lancé depuis un moment (ses boutons ont disparu),
 * pas avant `revealAfterMs`, et le son monte alors en fondu avec l'image.
 */
export function YoutubeBackground(props: YoutubeBackgroundProps) {
  let frame: HTMLIFrameElement | undefined;
  const [ready, setReady] = createSignal(false);
  const launched = Date.now();
  let playingSince: number | undefined;
  let fade: ReturnType<typeof setInterval> | undefined;

  const send = (func: string, args: unknown[] = []) =>
    frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');

  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame?.contentWindow) return;
    if (playingSince === undefined && isPlayingMessage(event.data)) playingSince = Date.now();
  };
  window.addEventListener('message', onMessage);

  const reveal = () => {
    setReady(true);
    send('setVolume', [0]);
    send('unMute');
    let step = 0;
    fade = setInterval(() => {
      step += 1;
      send('setVolume', [Math.round((props.volume * 100 * step) / FADE_STEPS)]);
      if (step >= FADE_STEPS) clearInterval(fade);
    }, FADE_MS / FADE_STEPS);
  };

  const check = setInterval(() => {
    const now = Date.now();
    const settled = playingSince !== undefined && now - playingSince >= SETTLE_MS;
    if ((settled && now - launched >= props.revealAfterMs) || now - launched >= FALLBACK_MS) {
      clearInterval(check);
      reveal();
    }
  }, CHECK_MS);

  onCleanup(() => {
    window.removeEventListener('message', onMessage);
    clearInterval(check);
    clearInterval(fade);
  });

  return (
    <iframe
      ref={(el) => (frame = el)}
      class={props.class}
      classList={{ [`${props.class}--ready`]: ready() }}
      src={youtubeUrl(props.id)}
      title={props.title}
      allow="autoplay; encrypted-media"
      tabIndex={-1}
      // Demande au lecteur de nous tenir au courant de son état.
      onLoad={() => frame?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')}
    />
  );
}
