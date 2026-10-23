import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { loadVolume, saveVolume } from '../../core/storage';
import {
  createPlayer,
  type Player,
  type PlayerState,
  type TrackList,
  type TrackType,
} from '../../player';
import { clamp, useRemote } from '../../ui/remote';

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

/** Durée d'affichage des commandes sans action (pendant la lecture). */
const CONTROLS_MS = 5000;
/** Pas d'avance / retour : ← → et ↑ ↓ quand la barre est masquée. */
const SHORT_SEEK = 10;
const LONG_SEEK = 60;
const VOLUME_STEP = 0.1;

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

type ControlId = 'back' | 'play' | 'forward' | 'audio' | 'subtitle' | 'volumeDown' | 'volumeUp';

interface TrackMenu {
  type: TrackType;
  selected: number;
}

/**
 * Lecteur plein écran pour les films et les épisodes.
 *
 * Barre masquée : ← → ±10 s, ↑ ↓ ±1 min, OK affiche la barre.
 * Barre affichée : ← → choisissent un bouton, OK l'active, ↓ / Retour la masquent.
 */
export function VodPlayer(props: VodPlayerProps) {
  const [state, setState] = createSignal<PlayerState>('loading');
  const [message, setMessage] = createSignal<string>();
  const [position, setPosition] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [paused, setPaused] = createSignal(false);
  const [volume, setVolume] = createSignal(loadVolume());
  const [controls, setControls] = createSignal(true);
  const [focused, setFocused] = createSignal<ControlId>('play');
  const [tracks, setTracks] = createSignal<TrackList>({ options: [], switchable: false });
  const [menu, setMenu] = createSignal<TrackMenu>();
  const [formatWarning, setFormatWarning] = createSignal<string>();
  let codecChecked = false;

  let video: HTMLVideoElement | undefined;
  let player: Player | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  /** Affiche la barre et relance le délai de masquage (sauf en pause ou menu ouvert). */
  const showControls = () => {
    setControls(true);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!paused() && !menu()) setControls(false);
    }, CONTROLS_MS);
  };

  const refreshTracks = () => player?.tracks().then(setTracks, () => undefined);

  onMount(() => {
    player = createPlayer(video!, {
      onStateChange: (next, text) => {
        setState(next);
        setMessage(text);
      },
    });
    player.setVolume(volume());
    player.play(props.url);
    void refreshTracks();
    showControls();
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

  const changeVolume = (delta: number) => {
    const next = Math.round(clamp(volume() + delta, 0, 1) * 10) / 10;
    setVolume(next);
    player?.setVolume(next);
    saveVolume(next);
  };

  const optionsOf = (type: TrackType) => tracks().options.filter((o) => o.type === type);
  /** Entrées du menu : pour les sous-titres, « Désactivés » en premier. */
  const menuEntries = (type: TrackType) => {
    const options = optionsOf(type).map((o) => ({ ...o, id: o.id as string | null }));
    if (type === 'audio') return options;
    const none = {
      id: null,
      type,
      label: 'Désactivés',
      selected: !options.some((o) => o.selected),
    };
    return [none, ...options];
  };

  const openMenu = (type: TrackType) => {
    const entries = menuEntries(type);
    setMenu({
      type,
      selected: Math.max(
        0,
        entries.findIndex((e) => e.selected),
      ),
    });
    showControls();
  };

  const chooseTrack = () => {
    const current = menu();
    if (!current) return;
    const entry = menuEntries(current.type)[current.selected];
    if (entry && tracks().switchable) {
      player?.selectTrack(current.type, entry.id);
      void refreshTracks();
    }
    setMenu(undefined);
    showControls();
  };

  const buttons = (): { id: ControlId; label: string; disabled?: boolean }[] => [
    { id: 'back', label: `« ${SHORT_SEEK} s` },
    { id: 'play', label: paused() ? '▶  Lecture' : '❚❚  Pause' },
    { id: 'forward', label: `${SHORT_SEEK} s »` },
    { id: 'audio', label: 'Audio', disabled: optionsOf('audio').length === 0 },
    { id: 'subtitle', label: 'Sous-titres', disabled: optionsOf('subtitle').length === 0 },
    { id: 'volumeDown', label: 'Volume −' },
    { id: 'volumeUp', label: 'Volume +' },
  ];

  const press = (id: ControlId) => {
    switch (id) {
      case 'back':
        return player?.seekBy(-SHORT_SEEK);
      case 'play':
        return player?.togglePause();
      case 'forward':
        return player?.seekBy(SHORT_SEEK);
      case 'audio':
      case 'subtitle':
        return openMenu(id);
      case 'volumeDown':
        return changeVolume(-VOLUME_STEP);
      case 'volumeUp':
        return changeVolume(VOLUME_STEP);
    }
  };

  useRemote((key) => {
    // Menu des pistes ouvert.
    const current = menu();
    if (current) {
      const count = menuEntries(current.type).length;
      if (key === 'up' || key === 'down') {
        const next = clamp(current.selected + (key === 'up' ? -1 : 1), 0, count - 1);
        setMenu({ ...current, selected: next });
      } else if (key === 'ok') chooseTrack();
      else setMenu(undefined);
      showControls();
      return;
    }

    // Barre masquée : raccourcis directs.
    if (!controls()) {
      showControls();
      if (key === 'left') player?.seekBy(-SHORT_SEEK);
      else if (key === 'right') player?.seekBy(SHORT_SEEK);
      else if (key === 'up') player?.seekBy(LONG_SEEK);
      else if (key === 'down') player?.seekBy(-LONG_SEEK);
      else if (key === 'back') props.onExit();
      return;
    }

    // Barre affichée : navigation entre les boutons.
    const list = buttons().filter((b) => !b.disabled);
    const index = Math.max(
      0,
      list.findIndex((b) => b.id === focused()),
    );
    switch (key) {
      case 'left':
      case 'right': {
        const next = clamp(index + (key === 'left' ? -1 : 1), 0, list.length - 1);
        setFocused(list[next].id);
        break;
      }
      case 'ok':
        press(list[index].id);
        break;
      case 'down':
      case 'back':
        clearTimeout(hideTimer);
        setControls(false);
        return;
    }
    showControls();
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

      <Show when={menu()}>
        {(current) => (
          <div class="track-menu">
            <h2 class="track-menu__title">
              {current().type === 'audio' ? 'Langue audio' : 'Sous-titres'}
            </h2>
            <For each={menuEntries(current().type)}>
              {(entry, index) => (
                <div
                  class="track-menu__item"
                  classList={{ 'track-menu__item--focused': index() === current().selected }}
                >
                  <span class="track-menu__check">{entry.selected ? '✓' : ''}</span>
                  {entry.label}
                </div>
              )}
            </For>
            <Show when={!tracks().switchable}>
              <p class="track-menu__note">
                Le navigateur du PC ne sait pas changer de piste dans ce fichier : le choix se fera
                sur la TV.
              </p>
            </Show>
          </div>
        )}
      </Show>

      <Show when={controls() || paused() || state() !== 'playing'}>
        <div class="vod-player__overlay">
          <p class="vod-player__title">{props.title}</p>
          <div class="vod-player__bar">
            <div class="vod-player__progress" style={{ width: `${progress()}%` }} />
          </div>
          <p class="vod-player__time">
            {formatTime(position())} / {duration() > 0 ? formatTime(duration()) : '--:--'}
            <span class="vod-player__volume">Volume {Math.round(volume() * 100)} %</span>
          </p>
          <Show when={controls()}>
            <div class="controls">
              <For each={buttons()}>
                {(button) => (
                  <span
                    class="controls__button"
                    classList={{
                      'controls__button--focused': button.id === focused(),
                      'controls__button--disabled': button.disabled,
                    }}
                  >
                    {button.label}
                  </span>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
