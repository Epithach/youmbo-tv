import { app } from '../app-state';
import { DEFAULT_COUNTRY } from '../core/country';
import { createSelection, useRemote } from '../ui/remote';
import { WindowedList } from '../ui/WindowedList';

/**
 * Choix du pays (et donc de la langue) pour toute l'app : chaînes TV,
 * films et séries. Proposé après le premier lien, puis depuis les paramètres.
 */
export function CountryScreen() {
  const countries = app.countries;
  // Au premier lancement, la France est proposée par défaut.
  const wanted = app.countryCode() ?? DEFAULT_COUNTRY;
  const current = countries().findIndex((entry) => entry.code === wanted);
  const selection = createSelection(() => countries().length, Math.max(0, current));

  const choose = (index: number) => {
    const entry = countries()[index];
    if (entry) app.chooseCountry(entry.code);
  };

  useRemote((key) => {
    if (key === 'up') selection.move(-1);
    else if (key === 'down') selection.move(1);
    else if (key === 'ok') choose(selection.index());
    else if (key === 'back') app.cancelEdit();
  });

  return (
    <div class="screen screen--center">
      <div class="picker">
        <h1 class="screen__title">Choisis ton pays</h1>
        <p class="screen__hint">
          Il sert pour les chaînes TV, les films et les séries. Tu pourras le changer dans les
          paramètres.
        </p>
        <WindowedList
          items={countries()}
          selected={selection.index()}
          active
          visibleRows={9}
          onSelect={selection.setIndex}
          onActivate={choose}
        >
          {(entry) => (
            <>
              <span class="row__label">{entry.name}</span>
              <span class="row__count">{entry.channels.length} chaînes</span>
            </>
          )}
        </WindowedList>
      </div>
    </div>
  );
}
