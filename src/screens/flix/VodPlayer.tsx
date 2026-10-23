import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createPlayer, type Player, type PlayerState } from '../../player';
import { useRemote } from '../../ui/remote';

interface VodPlayerProps {
  title: string;
  url: string;
  onExit: () => void;
  /** Fin de la vidéo : enchaîne sur l'épisode suivant s'il y en a un. */
  onEnded?: () => void;
}

/** Délai de lecture avant de vérifier que l'image et le son sont bien décodés. */
const CODEC_CHECK_SECONDS = 5;

/**
 * Le navigateur du PC lit l'image H.264/HEVC des MKV mais pas le son Dolby
 * (AC3/E-AC3) ni la vidéo MPEG-4 ancienne. La TV Samsung lit tout : on le dit
 * clairement plutôt que de laisser un film muet ou noir sans explication.
 */
function unsupportedFormat(video: HTMLVideoElement): string | undefined {
  if (video.videoWidth === 0) return 'Image non lisible sur ce navigateur (format vidéo ancien).';
  const decodedAudio = (video as HTMLVideoElement & { webkitAudioDecodedByteCount?: number })
    .webkitAudioDecodedByteCount;
  if (decodedAudio === 0) return 'Son Dolby (AC3) non lu par le navigateur du PC.';
  return undefined;
}

/** Durée de l'affichage des commandes après une action. */
const OVERLAY_MS = 4000;
/** Pas d'avance / retour : ← → et ↑ ↓. */
const SHORT_SEEK = 10;
const LONG_SEEK = 60;

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Lecteur plein écran pour les films et les épisodes. */
export function VodPlayer(props: VodPlayerProps) {
  const [state, setState] = createSignal<PlayerState>('loading');
  const [message, setMessage] = createSignal<string>();
  const [position, setPosition] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [paused, setPaused] = createSignal(false);
  const [overlay, setOverlay] = createSignal(true);
  const [formatWarning, setFormatWarning] = createSignal<string>();
  let codecChecked = false;

  let video: HTMLVideoElement | undefined;
  let player: Player | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const showOverlay = () => {
    setOverlay(true);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => setOverlay(false), OVERLAY_MS);
  };

  onMount(() => {
    player = createPlayer(video!, {
      onStateChange: (next, text) => {
        setState(next);
        setMessage(text);
      },
    });
    player.play(props.url);
    showOverlay();
    video!.addEventListener('ended', () => (props.onEnded ?? props.onExit)());
  });

  const tick = setInterval(() => {
    if (!player) return;
    setPosition(player.position());
    setDuration(player.duration());
    setPaused(player.paused());
    if (!codecChecked && video && player.position() >= CODEC_CHECK_SECONDS) {
      codecChecked = true;
      setFormatWarning(unsupportedFormat(video));
    }
  }, 500);

  onCleanup(() => {
    clearInterval(tick);
    clearTimeout(hideTimer);
    player?.destroy();
  });

  useRemote((key) => {
    showOverlay();
    switch (key) {
      case 'ok':
        return player?.togglePause();
      case 'left':
        return player?.seekBy(-SHORT_SEEK);
      case 'right':
        return player?.seekBy(SHORT_SEEK);
      case 'down':
        return player?.seekBy(-LONG_SEEK);
      case 'up':
        return player?.seekBy(LONG_SEEK);
      case 'back':
        return props.onExit();
    }
  });

  const progress = () => (duration() > 0 ? (position() / duration()) * 100 : 0);

  return (
    <div class="vod-player">
      <video ref={(el) => (video = el)} class="vod-player__video" />
      <Show when={state() === 'loading'}>
        <p class="vod-player__status">Chargement…</p>
      </Show>
      <Show when={state() === 'error'}>
        <p class="vod-player__status vod-player__status--error">{message()}</p>
      </Show>
      <Show when={formatWarning()}>
        <p class="vod-player__warning">{formatWarning()} Il sera lu normalement sur la TV.</p>
      </Show>
      <Show when={overlay() || paused() || state() !== 'playing'}>
        <div class="vod-player__overlay">
          <p class="vod-player__title">
            {paused() ? '❚❚ ' : ''}
            {props.title}
          </p>
          <div class="vod-player__bar">
            <div class="vod-player__progress" style={{ width: `${progress()}%` }} />
          </div>
          <p class="vod-player__time">
            {formatTime(position())} / {duration() > 0 ? formatTime(duration()) : '--:--'}
            <span class="vod-player__hint">
              OK pause · ← → 10 s · ↑ ↓ 1 min · Retour pour quitter
            </span>
          </p>
        </div>
      </Show>
    </div>
  );
}
