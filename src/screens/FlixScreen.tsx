import { app } from '../app-state';
import { useRemote } from '../ui/remote';

/** YoumboFlix : films et séries à la demande (en construction). */
export function FlixScreen() {
  useRemote((key) => {
    if (key === 'back') app.navigate('home');
  });

  return (
    <div class="screen screen--center">
      <h1 class="screen__title screen__title--brand">YoumboFlix</h1>
      <p class="screen__hint">Bientôt : films et séries. Retour pour revenir à l’accueil.</p>
    </div>
  );
}
