import type Hls from 'hls.js';
import { createSignal, Match, onCleanup, onMount, Switch } from 'solid-js';
import { invidiousStream } from '../core/invidious';
import { proxify } from '../core/net';
import { YoutubeBackground } from './YoutubeBackground';

/** La vidéo Invidious doit jouer dans ce délai, sinon on passe au lecteur YouTube. */
const START_TIMEOUT_MS = 12000;
/** Une bande-annonce de fond n'a pas besoin de plus (YouTube propose jusqu'à la 4K). */
const MAX_HEIGHT = 1080;
/** Montée du son, en même temps que le fondu de l'image. */
const FADE_MS = 1500;
const FADE_STEPS = 15;

interface TrailerBackgroundProps {
  /** Identifiant YouTube de la bande-annonce. */
  id: string;
  /** Classe de la vidéo ; `<classe>--ready` est ajoutée à l'apparition. */
  class: string;
  title: string;
  /** Volume visé, de 0 à 1. */
  volume: number;
  /** Délai minimal avant l'apparition, depuis le lancement. */
  revealAfterMs: number;
}

type Source = { kind: 'searching' } | { kind: 'hls'; url: string } | { kind: 'youtube' };

/**
 * Bande-annonce en fond : d'abord en vidéo directe via Invidious (pas de
 * vérification « robot » de YouTube), sinon avec le lecteur YouTube. Dans les
 * deux cas elle part muette et invisible, puis apparaît avec le son en fondu.
 */
export function TrailerBackground(props: TrailerBackgroundProps) {
  const launched = Date.now();
  const [source, setSource] = createSignal<Source>({ kind: 'searching' });
  let alive = true;
  onCleanup(() => (alive = false));

  onMount(() => {
    invidiousStream(props.id).then((url) => {
      if (alive) setSource(url ? { kind: 'hls', url } : { kind: 'youtube' });
    });
  });

  return (
    <Switch>
      <Match when={source().kind === 'hls' && (source() as { url: string }).url}>
        {(url) => (
          <HlsTrailer
            url={url()}
            class={props.class}
            volume={props.volume}
            revealAt={launched + props.revealAfterMs}
            onFail={() => setSource({ kind: 'youtube' })}
          />
        )}
      </Match>
      <Match when={source().kind === 'youtube'}>
        <YoutubeBackground
          id={props.id}
          class={props.class}
          title={props.title}
          volume={props.volume}
          revealAfterMs={Math.max(0, launched + props.revealAfterMs - Date.now())}
        />
      </Match>
    </Switch>
  );
}

interface HlsTrailerProps {
  url: string;
  class: string;
  volume: number;
  /** Heure (ms) avant laquelle la vidéo reste invisible. */
  revealAt: number;
  onFail: () => void;
}

/** Vidéo HLS muette et invisible, révélée avec le son en fondu une fois lancée. */
function HlsTrailer(props: HlsTrailerProps) {
  let video: HTMLVideoElement | undefined;
  let hls: Hls | undefined;
  let fade: ReturnType<typeof setInterval> | undefined;
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  const [ready, setReady] = createSignal(false);
  /** Arrêtée (échec ou écran quitté), ou déjà montrée : un échec n'y change plus rien. */
  let done = false;
  let revealed = false;

  const fail = () => {
    if (done || revealed) return;
    done = true;
    props.onFail();
  };
  const startTimer = setTimeout(fail, START_TIMEOUT_MS);

  const reveal = () => {
    if (!video) return;
    revealed = true;
    setReady(true);
    video.volume = 0;
    video.muted = false;
    let step = 0;
    fade = setInterval(() => {
      step += 1;
      if (video) video.volume = Math.min(1, (props.volume * step) / FADE_STEPS);
      if (step >= FADE_STEPS) clearInterval(fade);
    }, FADE_MS / FADE_STEPS);
  };

  const onPlaying = () => {
    clearTimeout(startTimer);
    if (revealed || revealTimer) return;
    revealTimer = setTimeout(reveal, Math.max(0, props.revealAt - Date.now()));
  };

  onMount(async () => {
    const { default: HlsClass } = await import('hls.js');
    if (!video || done) return;
    if (!HlsClass.isSupported()) return fail();
    // Les listes de lecture renvoient vers youtube.com, sans en-têtes CORS : en dev on
    // passe par le proxy local (sur la TV, une app Tizen n'est pas soumise au CORS).
    hls = new HlsClass({
      xhrSetup: (xhr, requestUrl) => xhr.open('GET', proxify(requestUrl), true),
    });
    // Rappel d'erreur d'hls.js, pas un calcul réactif : `props.onFail` y est lu au moment de l'échec.
    // eslint-disable-next-line solid/reactivity
    hls.on(HlsClass.Events.ERROR, (_event, data) => {
      if (data.fatal) fail();
    });
    hls.on(HlsClass.Events.MANIFEST_PARSED, (_event, data) => {
      // Qualités triées par débit : on s'arrête à la dernière qui ne dépasse pas MAX_HEIGHT.
      const allowed = data.levels.filter((level) => level.height <= MAX_HEIGHT).length;
      if (hls && allowed > 0) hls.autoLevelCapping = allowed - 1;
    });
    hls.loadSource(props.url);
    hls.attachMedia(video);
    video.play().catch(() => undefined);
  });

  onCleanup(() => {
    done = true;
    clearTimeout(startTimer);
    clearTimeout(revealTimer);
    clearInterval(fade);
    hls?.destroy();
  });

  return (
    <video
      ref={(el) => (video = el)}
      class={`${props.class} trailer-video`}
      classList={{ [`${props.class}--ready`]: ready() }}
      muted
      autoplay
      loop
      playsinline
      onPlaying={onPlaying}
      onError={fail}
    />
  );
}
