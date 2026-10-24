import { createEffect, createSignal, For } from 'solid-js';
import { app } from '../app-state';
import { randomHomeVideo } from '../core/home-media';
import { pointerMoved, useRemote } from '../ui/remote';

interface Side {
  id: 'tv' | 'flix';
  title: string;
  subtitle: string;
  disabled: boolean;
  open: () => void;
}

/**
 * Accueil scindé en deux, à la Tekken 8 : Télévision à gauche, YoumboFlix à
 * droite. Le côté sélectionné s'élargit et sa vidéo de fond s'anime ; l'autre
 * reste figé, assombri. ↑ atteint le bouton Paramètres.
 */
export function HomeScreen() {
  const sides: Side[] = [
    {
      id: 'tv',
      title: 'Télévision',
      subtitle: 'Chaînes en direct',
      disabled: false,
      open: () => app.navigate('tv'),
    },
    {
      id: 'flix',
      title: 'YoumboFlix',
      subtitle: app.xtream() ? 'Films et séries' : 'Nécessite un compte Xtream',
      disabled: !app.xtream(),
      open: () => app.navigate('flix'),
    },
  ];
  const [selected, setSelected] = createSignal(0);
  const [onSettings, setOnSettings] = createSignal(false);
  const videos: Record<Side['id'], HTMLVideoElement | undefined> = {
    tv: undefined,
    flix: undefined,
  };

  // Seule la vidéo du côté sélectionné joue : l'autre se fige (et la TV économise son décodeur).
  createEffect(() => {
    const active = onSettings() ? undefined : sides[selected()].id;
    for (const side of sides) {
      const video = videos[side.id];
      if (!video) continue;
      if (side.id === active) video.play().catch(() => undefined);
      else video.pause();
    }
  });

  const enter = (index: number) => {
    const side = sides[index];
    if (!side.disabled) side.open();
  };

  useRemote((key) => {
    if (onSettings()) {
      if (key === 'ok') app.navigate('settings');
      else if (key === 'down' || key === 'back') setOnSettings(false);
      return;
    }
    if (key === 'left') setSelected(0);
    else if (key === 'right') setSelected(1);
    else if (key === 'up') setOnSettings(true);
    else if (key === 'ok') enter(selected());
  });

  return (
    <div class="home">
      <For each={sides}>
        {(side, index) => (
          <section
            class={`home-panel home-panel--${side.id}`}
            classList={{
              'home-panel--selected': !onSettings() && index() === selected(),
              'home-panel--disabled': side.disabled,
            }}
            onMouseMove={(event) => {
              if (!pointerMoved(event)) return;
              setOnSettings(false);
              setSelected(index());
            }}
            onClick={() => enter(index())}
          >
            <video
              ref={(el) => (videos[side.id] = el)}
              class="home-panel__video"
              src={randomHomeVideo(side.id)}
              muted
              loop
              playsinline
              preload="auto"
              // Une vraie image en pause (beaucoup de vidéos commencent par du noir).
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                video.currentTime = Math.min(5, video.duration / 3);
              }}
            />
            <div class="home-panel__shade" />
            <div class="home-panel__text">
              <h2 class="home-panel__title">{side.title}</h2>
              <p class="home-panel__subtitle">{side.subtitle}</p>
            </div>
          </section>
        )}
      </For>
      <span class="home__brand">Youmbo TV</span>
      <button
        type="button"
        class="home__settings"
        classList={{ 'home__settings--selected': onSettings() }}
        onClick={() => app.navigate('settings')}
      >
        ⚙ Paramètres · {app.country()?.name}
      </button>
    </div>
  );
}
