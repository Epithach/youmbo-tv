import { createSignal, Show } from 'solid-js';
import { app } from '../app-state';
import { useRemote } from '../ui/remote';

/** Saisie du lien de la playlist : premier lancement, ou depuis les paramètres. */
export function SetupScreen() {
  useRemote((key) => {
    if (key === 'back') app.cancelEdit();
  });

  return (
    <div class="screen screen--center">
      <SetupForm
        initialUrl={app.suggestedUrl()}
        error={app.setupError()}
        loading={app.loading()}
        onSubmit={(url) => void app.connect(url)}
      />
    </div>
  );
}

interface SetupProps {
  initialUrl?: string;
  error?: string;
  loading: boolean;
  onSubmit: (url: string) => void;
}

function SetupForm(props: SetupProps) {
  const [url, setUrl] = createSignal(props.initialUrl ?? '');

  const submit = (event: Event) => {
    event.preventDefault();
    const value = url().trim();
    if (value) props.onSubmit(value);
  };

  return (
    <form class="setup" onSubmit={submit}>
      <h1 class="setup__title">Youmbo TV</h1>
      <p class="setup__hint">
        Colle le lien de ta playlist M3U ou ton lien Xtream (get.php) pour commencer.
      </p>
      <input
        class="setup__input"
        type="url"
        placeholder="http://…/playlist.m3u"
        value={url()}
        onInput={(event) => setUrl(event.currentTarget.value)}
        autofocus
      />
      <button class="setup__button" type="submit" disabled={props.loading}>
        {props.loading ? 'Chargement…' : 'Charger'}
      </button>
      <Show when={props.error}>
        <p class="setup__error">{props.error}</p>
      </Show>
    </form>
  );
}
