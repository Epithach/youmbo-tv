import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { app } from '../../app-state';
import { library, type WatchProgress } from '../../core/library';
import { loadPreferences, pickTracks } from '../../core/preferences';
import { loadVolume, saveVolume } from '../../core/storage';
import {
  createPlayer,
  type Player,
  type PlayerState,
  type TrackList,
  type TrackType,
} from '../../player';
import { clamp, pointerMoved, useRemote } from '../../ui/remote';
import { ControlBar, Progress, TrackMenu, type ControlButton } from './PlayerControls';

interface VodPlayerProps {
  title: string;
  url: string;
  onExit: () => void;
  /** Fin de la vidéo : enchaîne sur l'épisode suivant s'il y en a un. */
  onEnded?: () => void;
  /** Pour « Continuer à regarder » : ce qui est enregistré avec la position. */
  progress?: Omit<WatchProgress, 'position' | 'duration' | 'updatedAt'>;
  /** Reprendre à cette position (secondes). */
  startAt?: number;
}

/** Le bouton « Épisode suivant » apparaît dans ces dernières secondes. */
const NEXT_EPISODE_SECONDS = 30;

/** Fréquence d'enregistrement de la position de lecture. */
const SAVE_EVERY_MS = 10_000;

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

type ControlId =
  'back' | 'play' | 'forward' | 'audio' | 'subtitle' | 'volumeDown' | 'volumeUp' | 'exit';

interface OpenMenu {
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
  const [menu, setMenu] = createSignal<OpenMenu>();
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

  /** Langue audio et sous-titres préférés (Paramètres), si le lecteur sait changer de piste. */
  const applyPreferredTracks = async () => {
    const list = await player?.tracks().catch(() => undefined);
    if (!list) return;
    setTracks(list);
    if (!list.switchable) return;
    const pick = pickTracks(list.options, loadPreferences(app.country()?.code ?? ''));
    if (pick.audio) player?.selectTrack('audio', pick.audio);
    player?.selectTrack('subtitle', pick.subtitle);
    void refreshTracks();
  };

  /** « Épisode suivant » : proposé dans les dernières secondes s'il y a une suite. */
  const remaining = () => duration() - position();
  const nextVisible = () =>
    Boolean(props.onEnded) &&
    duration() > NEXT_EPISODE_SECONDS + 10 &&
    remaining() <= NEXT_EPISODE_SECONDS;

  onMount(() => {
    player = createPlayer(video!, {
      onStateChange: (next, text) => {
        setState(next);
        setMessage(text);
      },
    });
    player.setVolume(volume());
    player.play(props.url);
    void applyPreferredTracks();
    showControls();
    video!.addEventListener('ended', () => {
      saveProgress();
      (props.onEnded ?? props.onExit)();
    });
    // Reprise : on se place au bon endroit dès que la durée est connue.
    if (props.startAt) {
      const startAt = props.startAt;
      video!.addEventListener('loadedmetadata', () => player?.seekBy(startAt - player.position()), {
        once: true,
      });
    }
  });

  let lastSave = Date.now();
  const saveProgress = () => {
    if (!player || !props.progress || player.duration() <= 0) return;
    lastSave = Date.now();
    library.saveProgress({
      ...props.progress,
      position: player.position(),
      duration: player.duration(),
    });
  };

  const tick = setInterval(() => {
    if (!player) return;
    setPosition(player.position());
    setDuration(player.duration());
    setPaused(player.paused());
    if (!codecChecked && video && player.position() >= CODEC_CHECK_SECONDS) {
      codecChecked = true;
      setFormatWarning(unsupportedFormat(video));
    }
    if (!player.paused() && Date.now() - lastSave >= SAVE_EVERY_MS) saveProgress();
  }, 500);

  onCleanup(() => {
    saveProgress();
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

  const chooseTrack = (index = menu()?.selected ?? 0) => {
    const current = menu();
    if (!current) return;
    const entry = menuEntries(current.type)[index];
    if (entry && tracks().switchable) {
      player?.selectTrack(current.type, entry.id);
      void refreshTracks();
    }
    setMenu(undefined);
    showControls();
  };

  const buttons = (): ControlButton<ControlId>[] => [
    { id: 'back', label: `« ${SHORT_SEEK} s` },
    { id: 'play', label: paused() ? '▶  Lecture' : '❚❚  Pause' },
    { id: 'forward', label: `${SHORT_SEEK} s »` },
    { id: 'audio', label: 'Audio', disabled: optionsOf('audio').length === 0 },
    { id: 'subtitle', label: 'Sous-titres', disabled: optionsOf('subtitle').length === 0 },
    { id: 'volumeDown', label: 'Volume −' },
    { id: 'volumeUp', label: 'Volume +' },
    { id: 'exit', label: 'Quitter' },
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
      case 'exit':
        return props.onExit();
    }
  };

  useRemote((key) => {
    // Fin d'épisode : OK enchaîne tout de suite sur le suivant.
    if (nextVisible() && !menu() && key === 'ok' && !controls()) {
      saveProgress();
      return props.onEnded?.();
    }
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

  return (
    // Souris : bouger affiche les commandes, cliquer sur l'image met en pause.
    <div class="vod-player" onMouseMove={(event) => pointerMoved(event) && showControls()}>
      <video
        ref={(el) => (video = el)}
        class="vod-player__video"
        onClick={() => {
          player?.togglePause();
          showControls();
        }}
      />
      <Show when={state() === 'loading'}>
        <p class="vod-player__status">Chargement…</p>
      </Show>
      <Show when={state() === 'error'}>
        <p class="vod-player__status vod-player__status--error">{message()}</p>
      </Show>
      <Show when={formatWarning()}>
        <p class="vod-player__warning">{formatWarning()} Il sera lu normalement sur la TV.</p>
      </Show>

      <Show when={nextVisible()}>
        <button
          type="button"
          class="next-episode"
          onClick={() => {
            saveProgress();
            props.onEnded?.();
          }}
        >
          Épisode suivant ▶<small>dans {Math.max(0, Math.ceil(remaining()))} s · OK</small>
        </button>
      </Show>

      <Show when={menu()}>
        {(current) => (
          <TrackMenu
            title={current().type === 'audio' ? 'Langue audio' : 'Sous-titres'}
            entries={menuEntries(current().type)}
            focused={current().selected}
            readOnly={!tracks().switchable}
            onChoose={chooseTrack}
          />
        )}
      </Show>

      <Show when={controls() || paused() || state() !== 'playing'}>
        <div class="vod-player__overlay">
          <Progress
            title={props.title}
            position={position()}
            duration={duration()}
            volume={volume()}
            onSeek={(fraction) => player?.seekBy(fraction * duration() - position())}
          />
          <Show when={controls()}>
            <ControlBar
              buttons={buttons()}
              focused={focused()}
              onFocus={setFocused}
              onPress={(id) => {
                setFocused(id);
                press(id);
                showControls();
              }}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
