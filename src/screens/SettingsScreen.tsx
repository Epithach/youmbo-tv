import { createSignal } from 'solid-js';
import { app } from '../app-state';
import {
  AUDIO_LANGUAGES,
  loadPreferences,
  savePreferences,
  SUBTITLE_MODES,
  type PlaybackPreferences,
} from '../core/preferences';
import { Menu, pressMenuItem, type MenuItem } from '../ui/Menu';
import { createSelection, useRemote } from '../ui/remote';

/** N'affiche que l'hôte : le lien complet contient les identifiants. */
function describeUrl(url: string | undefined): string {
  if (!url) return 'Aucun';
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Élément suivant d'une liste, en revenant au début après le dernier. */
const nextOf = <T,>(list: readonly T[], current: T) =>
  list[(list.indexOf(current) + 1) % list.length];

export function SettingsScreen() {
  const [preferences, setPreferences] = createSignal(loadPreferences(app.country()?.code ?? ''));
  const update = (change: Partial<PlaybackPreferences>) => {
    const next = { ...preferences(), ...change };
    setPreferences(next);
    savePreferences(next);
  };
  const audioLabel = () =>
    AUDIO_LANGUAGES.find((l) => l.code === preferences().audioLanguage)?.label ??
    'Version originale';
  const subtitleLabel = () =>
    SUBTITLE_MODES.find((m) => m.mode === preferences().subtitles)?.label ?? '';

  const items = (): MenuItem[] => [
    {
      label: 'Playlist',
      detail: describeUrl(app.playlistUrl()),
      onPress: () => app.editFromSettings('setup'),
    },
    {
      label: 'Pays et langue',
      detail: app.country()?.name,
      onPress: () => app.editFromSettings('country'),
    },
    {
      label: 'Langue audio des films et séries',
      detail: `${audioLabel()} · OK pour changer`,
      onPress: () => {
        const codes = AUDIO_LANGUAGES.map((l) => l.code);
        update({ audioLanguage: nextOf(codes, preferences().audioLanguage) });
      },
    },
    {
      label: 'Sous-titres',
      detail: `${subtitleLabel()} · OK pour changer`,
      onPress: () => {
        const modes = SUBTITLE_MODES.map((m) => m.mode);
        update({ subtitles: nextOf(modes, preferences().subtitles) });
      },
    },
    { label: 'Retour à l’accueil', onPress: () => app.navigate('home') },
  ];
  const selection = createSelection(() => items().length);

  useRemote((key) => {
    if (key === 'up') selection.move(-1);
    else if (key === 'down') selection.move(1);
    else if (key === 'ok') pressMenuItem(items(), selection.index());
    else if (key === 'back') app.navigate('home');
  });

  return (
    <div class="screen screen--center">
      <div class="picker">
        <h1 class="screen__title">Paramètres</h1>
        <Menu items={items()} selected={selection.index()} onSelect={selection.setIndex} />
      </div>
    </div>
  );
}
