import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { app } from '../../app-state';
import { formatClock, loadShortEpg, nowAndNext, type Programme } from '../../core/epg';
import { library } from '../../core/library';
import type { Channel } from '../../core/m3u';

/**
 * Attente avant de demander le programme d'une chaîne sélectionnée : en
 * faisant défiler la liste, on ne déclenche pas une requête par chaîne
 * (le fournisseur bloquerait l'adresse IP).
 */
const SELECTION_DELAY_MS = 600;
/** Rafraîchissement de la barre de progression. */
const CLOCK_MS = 30_000;

/** Bandeau sous la vidéo : émission en cours (avec progression) et suivante. */
export function ChannelInfo(props: { channel: Channel | undefined; showFavoriteHint: boolean }) {
  const [programmes, setProgrammes] = createSignal<{ channelId: string; list: Programme[] }>();
  const [clock, setClock] = createSignal(Date.now());

  const ticker = setInterval(() => setClock(Date.now()), CLOCK_MS);
  onCleanup(() => clearInterval(ticker));

  createEffect(() => {
    const channel = props.channel;
    const credentials = app.xtream();
    if (!channel?.streamId || !credentials) return;
    const timer = setTimeout(() => {
      loadShortEpg(credentials, channel.streamId!).then(
        (list) => setProgrammes({ channelId: channel.id, list }),
        () => setProgrammes({ channelId: channel.id, list: [] }),
      );
    }, SELECTION_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  /** Programme de la chaîne affichée (pas celui d'une chaîne vue juste avant). */
  const current = () => {
    const loaded = programmes();
    if (!loaded || loaded.channelId !== props.channel?.id) return undefined;
    return nowAndNext(loaded.list, clock());
  };
  const progress = (programme: Programme) =>
    Math.min(
      100,
      Math.max(0, ((clock() - programme.start) / (programme.end - programme.start)) * 100),
    );

  return (
    <Show when={props.channel}>
      {(channel) => (
        <div class="channel-info">
          <p class="channel-info__name">
            {channel().name}
            <Show when={props.showFavoriteHint}>
              <span class="channel-info__hint">
                {library.isFavoriteChannel(channel())
                  ? '★ Favori · → pour retirer'
                  : '→ pour ajouter aux favoris'}
              </span>
            </Show>
          </p>
          <Show
            when={current()}
            fallback={
              <p class="channel-info__muted">
                {channel().streamId && app.xtream() ? 'Chargement du programme…' : ''}
              </p>
            }
          >
            {(epg) => (
              <Show
                when={epg().now || epg().next}
                fallback={<p class="channel-info__muted">Programme indisponible</p>}
              >
                <Show when={epg().now}>
                  {(now) => (
                    <div class="channel-info__now">
                      <p class="channel-info__line">
                        <span class="channel-info__time">
                          {formatClock(now().start)} – {formatClock(now().end)}
                        </span>
                        {now().title}
                      </p>
                      <div class="channel-info__bar">
                        <div
                          class="channel-info__progress"
                          style={{ width: `${progress(now())}%` }}
                        />
                      </div>
                      <Show when={now().description}>
                        <p class="channel-info__description">{now().description}</p>
                      </Show>
                    </div>
                  )}
                </Show>
                <Show when={epg().next}>
                  {(next) => (
                    <p class="channel-info__line channel-info__muted">
                      <span class="channel-info__time">Ensuite {formatClock(next().start)}</span>
                      {next().title}
                    </p>
                  )}
                </Show>
              </Show>
            )}
          </Show>
        </div>
      )}
    </Show>
  );
}
