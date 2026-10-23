import { createSignal, Show } from 'solid-js';

interface SetupProps {
  initialUrl?: string;
  error?: string;
  loading: boolean;
  onSubmit: (url: string) => void;
}

export function Setup(props: SetupProps) {
  const [url, setUrl] = createSignal(props.initialUrl ?? '');

  const submit = (event: Event) => {
    event.preventDefault();
    const value = url().trim();
    if (value) props.onSubmit(value);
  };

  return (
    <form class="setup" onSubmit={submit}>
      <h1 class="setup__title">Youmbo TV</h1>
      <p class="setup__hint">Colle le lien de ta playlist M3U pour commencer.</p>
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
