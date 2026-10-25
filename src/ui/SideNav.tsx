import { createEffect, createSignal, For, onCleanup, onMount, type JSX } from 'solid-js';
import { app } from '../app-state';
import { clamp } from './remote';

/** Partie de l'app où l'on se trouve, mise en avant dans le bandeau. */
export type NavSection = 'tv' | 'movies' | 'series' | 'settings';

type NavId = 'home' | 'search' | NavSection;

/** Icônes au trait (24×24), dans la couleur du texte. */
const ICONS: Record<NavId, () => JSX.Element> = {
  home: () => <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  search: () => (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  tv: () => (
    <>
      <path d="m8 3 4 4 4-4" />
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <text x="12" y="17.2" class="side-nav__logo">
        TV
      </text>
    </>
  ),
  movies: () => (
    <>
      <rect x="3" y="10" width="18" height="11" rx="1" />
      <path d="m3 10-.6-3.2a1 1 0 0 1 .8-1.2L18.8 2.8a1 1 0 0 1 1.2.8l.6 3.3z" />
      <path d="m7.5 5.2 2.4 3.4M12.6 4.2 15 7.6M17.6 3.3 20 6.7" />
    </>
  ),
  series: () => (
    <>
      <path d="M6 3h12" />
      <rect x="2" y="6" width="20" height="15" rx="2" />
      <path d="M10 10.5v6l5-3z" class="side-nav__fill" />
    </>
  ),
  settings: () => (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
};

const ITEMS: { id: NavId; label: string }[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'search', label: 'Recherche' },
  { id: 'tv', label: 'Télévision' },
  { id: 'movies', label: 'Films' },
  { id: 'series', label: 'Séries' },
  { id: 'settings', label: 'Paramètres' },
];

const [opened, setOpened] = createSignal(false);

/** Donne la main au bandeau : appelé par un écran quand on va tout à gauche. */
export const openSideNav = () => setOpened(true);

/**
 * Bandeau de navigation à gauche, toujours visible (translucide), à la
 * Netflix : → ou Retour rend la main à l'écran, OK ouvre la partie choisie.
 * Tant qu'il a la main, il reçoit les touches avant l'écran.
 */
export function SideNav(props: { current: NavSection }) {
  const currentIndex = () => ITEMS.findIndex((item) => item.id === props.current);
  const [selected, setSelected] = createSignal(currentIndex());

  const go = (id: NavId) => {
    setOpened(false);
    if (id === props.current) return;
    if (id === 'home') app.navigate('home');
    else if (id === 'search') app.openSearch(props.current === 'tv' ? 'tv' : 'flix');
    else if (id === 'tv' || id === 'settings') app.navigate(id);
    else app.openFlix(id);
  };

  // Écoute en phase de capture : le bandeau passe avant les écrans et garde la touche.
  const onKeyDown = (event: KeyboardEvent) => {
    if (!opened()) return;
    const code = event.keyCode;
    if (code === 38 || code === 40) {
      setSelected(clamp(selected() + (code === 38 ? -1 : 1), 0, ITEMS.length - 1));
    } else if (code === 13) {
      go(ITEMS[selected()].id);
    } else if (code === 39 || code === 27 || code === 8 || code === 10009) {
      setOpened(false);
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  onMount(() => {
    setOpened(false);
    window.addEventListener('keydown', onKeyDown, true);
  });
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown, true);
    setOpened(false);
  });

  // À chaque ouverture, la sélection repart de la partie en cours.
  createEffect(() => {
    if (opened()) setSelected(currentIndex());
  });
  const isOpen = () => opened();

  return (
    <nav class="side-nav" classList={{ 'side-nav--open': isOpen() }}>
      <For each={ITEMS}>
        {(item, index) => (
          <button
            type="button"
            class="side-nav__item"
            classList={{
              'side-nav__item--current': item.id === props.current,
              'side-nav__item--selected': isOpen() && index() === selected(),
              'side-nav__item--bottom': item.id === 'settings',
            }}
            aria-label={item.label}
            tabIndex={-1}
            onClick={() => go(item.id)}
          >
            <svg class="side-nav__icon" viewBox="0 0 24 24" aria-hidden="true">
              {ICONS[item.id]()}
            </svg>
            <span class="side-nav__label">{item.label}</span>
          </button>
        )}
      </For>
    </nav>
  );
}
