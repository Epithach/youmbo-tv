import { app } from '../app-state';
import { Menu, pressMenuItem, type MenuItem } from '../ui/Menu';
import { createSelection, useRemote } from '../ui/remote';

/** Accueil : Télévision ou YoumboFlix, et l'accès aux paramètres. */
export function HomeScreen() {
  const items: MenuItem[] = [
    { label: 'Télévision', detail: 'Chaînes en direct', onPress: () => app.navigate('tv') },
    {
      label: 'YoumboFlix',
      detail: app.xtream() ? 'Films et séries' : 'Nécessite un compte Xtream',
      disabled: !app.xtream(),
      onPress: () => app.navigate('flix'),
    },
    { label: 'Recherche', detail: 'Chaînes, films, séries', onPress: () => app.navigate('search') },
    { label: 'Paramètres', detail: app.country()?.name, onPress: () => app.navigate('settings') },
  ];
  const selection = createSelection(() => items.length);

  useRemote((key) => {
    if (key === 'left' || key === 'up') selection.move(-1);
    else if (key === 'right' || key === 'down') selection.move(1);
    else if (key === 'ok') pressMenuItem(items, selection.index());
  });

  return (
    <div class="screen screen--center">
      <h1 class="screen__title screen__title--brand">Youmbo TV</h1>
      <Menu
        items={items}
        selected={selection.index()}
        onSelect={selection.setIndex}
        direction="row"
      />
    </div>
  );
}
