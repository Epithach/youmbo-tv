import { app } from '../app-state';
import { useRemote } from '../ui/remote';
import { Setup } from '../ui/Setup';

/** Saisie du lien de la playlist : premier lancement, ou depuis les paramètres. */
export function SetupScreen() {
  useRemote((key) => {
    if (key === 'back') app.cancelEdit();
  });

  return (
    <div class="screen screen--center">
      <Setup
        initialUrl={app.suggestedUrl()}
        error={app.setupError()}
        loading={app.loading()}
        onSubmit={(url) => void app.connect(url)}
      />
    </div>
  );
}
