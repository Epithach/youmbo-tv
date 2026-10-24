import { Match, onMount, Switch } from 'solid-js';
import { app } from './app-state';
import { CountryScreen } from './screens/CountryScreen';
import { FlixScreen } from './screens/FlixScreen';
import { GuideScreen } from './screens/GuideScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SetupScreen } from './screens/SetupScreen';
import { TvScreen } from './screens/TvScreen';

/** Aiguillage entre les écrans : chacun gère sa télécommande tant qu'il est affiché. */
export function App() {
  onMount(() => void app.boot());

  return (
    <div class="app">
      <Switch fallback={<p class="splash">Chargement…</p>}>
        <Match when={app.screen() === 'setup'}>
          <SetupScreen />
        </Match>
        <Match when={app.screen() === 'country'}>
          <CountryScreen />
        </Match>
        <Match when={app.screen() === 'home'}>
          <HomeScreen />
        </Match>
        <Match when={app.screen() === 'settings'}>
          <SettingsScreen />
        </Match>
        <Match when={app.screen() === 'tv'}>
          <TvScreen />
        </Match>
        <Match when={app.screen() === 'flix'}>
          <FlixScreen />
        </Match>
        <Match when={app.screen() === 'search'}>
          <SearchScreen />
        </Match>
        <Match when={app.screen() === 'guide'}>
          <GuideScreen />
        </Match>
      </Switch>
    </div>
  );
}
