import { For, Show } from 'solid-js';

/** Affichage du lecteur VOD (sans logique) : progression, boutons, menu des pistes. */

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

interface ProgressProps {
  title: string;
  position: number;
  duration: number;
  volume: number;
}

export function Progress(props: ProgressProps) {
  const percent = () => (props.duration > 0 ? (props.position / props.duration) * 100 : 0);
  return (
    <>
      <p class="vod-player__title">{props.title}</p>
      <div class="vod-player__bar">
        <div class="vod-player__progress" style={{ width: `${percent()}%` }} />
      </div>
      <p class="vod-player__time">
        {formatTime(props.position)} / {props.duration > 0 ? formatTime(props.duration) : '--:--'}
        <span class="vod-player__volume">Volume {Math.round(props.volume * 100)} %</span>
      </p>
    </>
  );
}

export interface ControlButton<Id extends string> {
  id: Id;
  label: string;
  disabled?: boolean;
}

export function ControlBar<Id extends string>(props: {
  buttons: ControlButton<Id>[];
  focused: Id;
}) {
  return (
    <div class="controls">
      <For each={props.buttons}>
        {(button) => (
          <span
            class="controls__button"
            classList={{
              'controls__button--focused': button.id === props.focused,
              'controls__button--disabled': button.disabled,
            }}
          >
            {button.label}
          </span>
        )}
      </For>
    </div>
  );
}

interface TrackMenuProps {
  title: string;
  entries: { label: string; selected: boolean }[];
  focused: number;
  /** Le lecteur ne sait pas changer de piste (navigateur du PC). */
  readOnly: boolean;
}

export function TrackMenu(props: TrackMenuProps) {
  return (
    <div class="track-menu">
      <h2 class="track-menu__title">{props.title}</h2>
      <For each={props.entries}>
        {(entry, index) => (
          <div
            class="track-menu__item"
            classList={{ 'track-menu__item--focused': index() === props.focused }}
          >
            <span class="track-menu__check">{entry.selected ? '✓' : ''}</span>
            {entry.label}
          </div>
        )}
      </For>
      <Show when={props.readOnly}>
        <p class="track-menu__note">
          Le navigateur du PC ne sait pas changer de piste dans ce fichier : le choix se fera sur la
          TV.
        </p>
      </Show>
    </div>
  );
}
