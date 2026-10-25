import { createSignal, onCleanup, Show } from 'solid-js';

/** Après le début de la lecture, le lecteur YouTube garde ses boutons affichés un moment. */
const SETTLE_MS = 2500;
/**
 * Sans lecture au bout de ce délai (YouTube demande « Confirmez que vous n'êtes
 * pas un robot », vidéo bloquée…), on abandonne : l'image fixe reste affichée.
 */
const GIVE_UP_MS = 12000;
/** Montée du son, en même temps que le fondu de l'image. */
const FADE_MS = 1500;
const FADE_STEPS = 15;
const CHECK_MS = 250;

/**
 * Lecteur YouTube muet au départ, sans commandes, en boucle, pilotable.
 * youtube.com (et non youtube-nocookie.com) : connecté à YouTube dans le
 * navigateur, on passe la vérification « pas un robot ».
 */
export const youtubeUrl = (id: string) =>
  `https://www.youtube.com/embed/${encodeURIComponent(id)}` +
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

/** Message du lecteur YouTube : il joue (état 1), il a échoué, ou rien d'utile. */
function readMessage(data: unknown): 'playing' | 'error' | undefined {
  if (typeof data !== 'string') return undefined;
  try {
    const message = JSON.parse(data) as { event?: string; info?: unknown };
    if (message.event === 'onError') return 'error';
    const info = message.info as { playerState?: number } | number | undefined;
    const playing =
      (message.event === 'onStateChange' && info === 1) ||
      (typeof info === 'object' && info?.playerState === 1);
    return playing ? 'playing' : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Bande-annonce YouTube en fond : lancée muette et invisible, elle n'apparaît
 * qu'une fois le lecteur lancé depuis un moment (ses boutons ont disparu),
 * pas avant `revealAfterMs`, et le son monte alors en fondu avec l'image.
 * S'il ne joue jamais (vérification « robot », vidéo bloquée), il disparaît
 * sans s'être montré : l'image fixe reste.
 */
export function YoutubeBackground(props: YoutubeBackgroundProps) {
  let frame: HTMLIFrameElement | undefined;
  const [ready, setReady] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const launched = Date.now();
  let playingSince: number | undefined;
  let fade: ReturnType<typeof setInterval> | undefined;

  const send = (func: string, args: unknown[] = []) =>
    frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');

  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame?.contentWindow) return;
    const state = readMessage(event.data);
    if (state === 'error' && !ready()) giveUp();
    else if (state === 'playing' && playingSince === undefined) playingSince = Date.now();
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
    if (settled && now - launched >= props.revealAfterMs) {
      clearInterval(check);
      reveal();
    } else if (playingSince === undefined && now - launched >= GIVE_UP_MS) giveUp();
  }, CHECK_MS);

  function giveUp() {
    clearInterval(check);
    setFailed(true);
  }

  onCleanup(() => {
    window.removeEventListener('message', onMessage);
    clearInterval(check);
    clearInterval(fade);
  });

  return (
    <Show when={!failed()}>
      <iframe
        ref={(el) => (frame = el)}
        class={props.class}
        classList={{ [`${props.class}--ready`]: ready() }}
        src={youtubeUrl(props.id)}
        title={props.title}
        allow="autoplay; encrypted-media"
        tabIndex={-1}
        // Demande au lecteur de nous tenir au courant de son état.
        onLoad={() =>
          frame?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
        }
      />
    </Show>
  );
}
