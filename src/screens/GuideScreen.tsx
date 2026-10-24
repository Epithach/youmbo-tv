import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from 'solid-js';
import { app } from '../app-state';
import { formatClock, loadEpgDay, type Programme } from '../core/epg';
import type { Channel } from '../core/m3u';
import { catchupUrl } from '../core/xtream';
import { clamp, useRemote } from '../ui/remote';

/** Chaînes affichées autour de la sélection. */
const ROWS_BEFORE = 3;
const ROWS_AFTER = 5;
/** Largeur d'une minute dans la grille, et durée visible. */
const PX_PER_MINUTE = 7;
const VISIBLE_MINUTES = 180;
const SLOT_MINUTES = 30;
/** Attente avant de charger le programme des chaînes visibles (pas pendant un défilement). */
const LOAD_DELAY_MS = 400;
const MINUTE = 60_000;

const floorToSlot = (time: number) =>
  Math.floor(time / (SLOT_MINUTES * MINUTE)) * SLOT_MINUTES * MINUTE;

type Status = 'live' | 'replay' | 'past' | 'future';

/** Où en est une émission : en direct, disponible en replay, passée ou à venir. */
export function programmeStatus(programme: Programme, channel: Channel, now: number): Status {
  if (programme.start <= now && now < programme.end) return 'live';
  if (programme.start > now) return 'future';
  const inArchive =
    channel.archiveDays !== undefined && now - programme.start <= channel.archiveDays * 86_400_000;
  return inArchive && programme.archived !== false ? 'replay' : 'past';
}

const STATUS_LABELS: Record<Status, string> = {
  live: '● En direct · OK pour regarder',
  replay: '↺ Replay disponible · OK pour regarder',
  past: 'Émission passée',
  future: 'À venir',
};

/**
 * Guide des programmes : chaînes × horaires, à la TiviMate.
 * ↑ ↓ changent de chaîne, ← → d'émission ; OK lance le direct ou le replay.
 */
export function GuideScreen() {
  const channels = () => app.country()?.channels ?? [];
  const [now, setNow] = createSignal(Date.now());
  const clock = setInterval(() => setNow(Date.now()), MINUTE);
  onCleanup(() => clearInterval(clock));

  const [row, setRow] = createSignal(0);
  /** Instant visé : la sélection suit l'émission qui le contient en changeant de chaîne. */
  const [focusTime, setFocusTime] = createSignal(Date.now());
  const [windowStart, setWindowStart] = createSignal(
    floorToSlot(Date.now()) - SLOT_MINUTES * MINUTE,
  );
  const [epg, setEpg] = createSignal<Record<string, Programme[] | 'loading'>>({});

  const visible = createMemo(() => {
    const start = Math.max(0, row() - ROWS_BEFORE);
    return channels()
      .slice(start, start + ROWS_BEFORE + ROWS_AFTER + 1)
      .map((channel, offset) => ({ channel, index: start + offset }));
  });

  // Programme des chaînes visibles, une fois la sélection posée.
  createEffect(() => {
    const credentials = app.xtream();
    const list = visible();
    if (!credentials) return;
    const timer = setTimeout(() => {
      for (const { channel } of list) {
        if (!channel.streamId || untrack(epg)[channel.id]) continue;
        setEpg((current) => ({ ...current, [channel.id]: 'loading' }));
        loadEpgDay(credentials, channel.streamId).then(
          (programmes) => setEpg((current) => ({ ...current, [channel.id]: programmes })),
          () => setEpg((current) => ({ ...current, [channel.id]: [] })),
        );
      }
    }, LOAD_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  const programmesOf = (channel: Channel) => {
    const state = epg()[channel.id];
    return Array.isArray(state) ? state : [];
  };
  const channel = () => channels()[row()];
  const selected = createMemo(() => {
    const current = channel();
    if (!current) return undefined;
    const list = programmesOf(current);
    const time = focusTime();
    return (
      list.find((p) => p.start <= time && time < p.end) ??
      list.find((p) => p.start > time) ??
      list[list.length - 1]
    );
  });

  // La grille défile pour garder l'émission sélectionnée visible.
  createEffect(() => {
    const programme = selected();
    if (!programme) return;
    // Point à garder à l'écran : l'instant visé, borné à l'émission sélectionnée.
    const anchor = Math.min(Math.max(focusTime(), programme.start), programme.end - 1);
    const start = untrack(windowStart);
    const end = start + VISIBLE_MINUTES * MINUTE;
    if (anchor < start) setWindowStart(floorToSlot(anchor));
    else if (anchor >= end - SLOT_MINUTES * MINUTE) {
      setWindowStart(floorToSlot(anchor) - 60 * MINUTE);
    }
  });

  const moveProgramme = (delta: number) => {
    const current = channel();
    const programme = selected();
    if (!current || !programme) return;
    const list = programmesOf(current);
    const next = list[clamp(list.indexOf(programme) + delta, 0, list.length - 1)];
    if (!next) return;
    // Sur l'émission en cours, on vise « maintenant » ; sinon son début.
    setFocusTime(next.start <= now() && now() < next.end ? now() : next.start);
  };

  const watch = () => {
    const current = channel();
    const programme = selected();
    const credentials = app.xtream();
    if (!current || !programme) return;
    const status = programmeStatus(programme, current, now());
    if (status === 'live') app.openResult({ kind: 'channel', channel: current });
    else if (status === 'replay' && credentials && current.streamId) {
      app.openResult({
        kind: 'replay',
        channel: current,
        title: `${programme.title} (${formatClock(programme.start)})`,
        url: catchupUrl(credentials, current.streamId, programme.start, programme.end),
      });
    }
  };

  useRemote((key) => {
    switch (key) {
      case 'up':
      case 'down':
        return setRow(clamp(row() + (key === 'up' ? -1 : 1), 0, channels().length - 1));
      case 'left':
      case 'right':
        return moveProgramme(key === 'left' ? -1 : 1);
      case 'ok':
        return watch();
      case 'back':
        return app.navigate('tv');
    }
  });

  const x = (time: number) => ((time - windowStart()) / MINUTE) * PX_PER_MINUTE;
  const slots = createMemo(() => {
    const start = windowStart();
    return Array.from(
      { length: VISIBLE_MINUTES / SLOT_MINUTES },
      (_, i) => start + i * SLOT_MINUTES * MINUTE,
    );
  });
  const inWindow = (p: Programme) =>
    p.end > windowStart() && p.start < windowStart() + VISIBLE_MINUTES * MINUTE;

  return (
    <div class="guide">
      <header class="guide__header">
        <h1 class="screen__title">Guide TV</h1>
        <span class="guide__clock">{formatClock(now())}</span>
      </header>

      <div class="guide__grid">
        <div class="guide__ruler">
          <span class="guide__corner" />
          <div class="guide__times">
            <For each={slots()}>
              {(time) => (
                <span class="guide__time" style={{ left: `${x(time)}px` }}>
                  {formatClock(time)}
                </span>
              )}
            </For>
          </div>
        </div>

        <For each={visible()}>
          {({ channel: rowChannel, index }) => (
            <div class="guide__row" classList={{ 'guide__row--active': index === row() }}>
              <div class="guide__channel" onClick={() => setRow(index)}>
                <Show when={rowChannel.logo}>
                  <img src={rowChannel.logo} alt="" loading="lazy" />
                </Show>
                <span>{rowChannel.name}</span>
              </div>
              <div class="guide__programmes">
                <Show
                  when={programmesOf(rowChannel).length > 0}
                  fallback={
                    <span class="guide__empty">
                      {epg()[rowChannel.id] === 'loading'
                        ? 'Chargement…'
                        : 'Programme indisponible'}
                    </span>
                  }
                >
                  <For each={programmesOf(rowChannel).filter(inWindow)}>
                    {(programme) => {
                      const status = () => programmeStatus(programme, rowChannel, now());
                      return (
                        <div
                          class="guide__programme"
                          classList={{
                            'guide__programme--selected':
                              index === row() && programme === selected(),
                            'guide__programme--live': status() === 'live',
                            'guide__programme--past': status() === 'past',
                          }}
                          style={{
                            left: `${Math.max(0, x(programme.start))}px`,
                            width: `${x(programme.end) - Math.max(0, x(programme.start)) - 4}px`,
                          }}
                          onClick={() => {
                            setRow(index);
                            setFocusTime(programme.start);
                          }}
                          onDblClick={watch}
                        >
                          <span class="guide__programme-title">
                            {status() === 'replay' ? '↺ ' : ''}
                            {programme.title}
                          </span>
                          <span class="guide__programme-time">{formatClock(programme.start)}</span>
                        </div>
                      );
                    }}
                  </For>
                </Show>
              </div>
            </div>
          )}
        </For>

        <Show when={now() >= windowStart() && now() < windowStart() + VISIBLE_MINUTES * MINUTE}>
          <div
            class="guide__now"
            style={{ left: `calc(var(--guide-channel-width) + ${x(now())}px)` }}
          />
        </Show>
      </div>

      <Show when={channel() && selected()}>
        {(programme) => (
          <footer class="guide__details">
            <p class="guide__details-title">
              {programme().title}
              <span class="guide__details-time">
                {formatClock(programme().start)} – {formatClock(programme().end)} ·{' '}
                {channel()!.name}
              </span>
            </p>
            <Show when={programme().description}>
              <p class="guide__details-description">{programme().description}</p>
            </Show>
            <p class="guide__details-status">
              {STATUS_LABELS[programmeStatus(programme(), channel()!, now())]}
            </p>
          </footer>
        )}
      </Show>
    </div>
  );
}
