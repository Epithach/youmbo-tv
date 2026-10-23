import { app } from '../app-state';
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

export function SettingsScreen() {
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
