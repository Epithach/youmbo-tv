import { expect, test, type Page } from '@playwright/test';

/**
 * Parcours principaux sur le faux serveur Xtream (`npm run dev:mock`).
 * Chaque test part d'un navigateur vierge : premier lancement compris.
 * La lecture vidéo n'est pas vérifiée (le Chromium de Playwright n'a pas les
 * codecs H.264) : on teste l'interface et les données.
 */

const press = (page: Page, ...keys: string[]) =>
  keys.reduce((done, key) => done.then(() => page.keyboard.press(key)), Promise.resolve());

/** Premier lancement : lien pré-rempli (`.env.mock`), puis pays proposé : France. */
async function onboard(page: Page) {
  await page.goto('/');
  await expect(page.locator('.setup__input')).toHaveValue(/localhost:5180\/get\.php/);
  await page.getByRole('button', { name: 'Charger' }).click();
  await expect(page.getByRole('heading', { name: 'Choisis ton pays' })).toBeVisible();
  await expect(page.locator('.list__row--selected')).toContainText('France');
  await press(page, 'Enter');
  await expect(page.locator('.menu__item')).toHaveCount(3);
}

const rowTitles = (page: Page) => page.locator('.flix-row__title');
/** Les affiches de la rangée sélectionnée sont chargées (avant d'appuyer sur OK). */
const activePosters = (page: Page) =>
  expect(page.locator('.flix-row--active .poster').first()).toBeVisible();

test('premier lancement : lien, pays puis accueil', async ({ page }) => {
  await onboard(page);
  await expect(page.locator('.menu__label')).toHaveText(['Télévision', 'YoumboFlix', 'Paramètres']);
  // Au lancement suivant, l'app ouvre directement l'accueil.
  await page.reload();
  await expect(page.locator('.menu__item')).toHaveCount(3);
});

test('télévision : chaînes du pays, programme en cours et favoris', async ({ page }) => {
  await onboard(page);
  await press(page, 'Enter');

  const channels = page.locator('.column--channels .row__label');
  await expect(channels.first()).toHaveText('FR - Chaîne Une');
  // Le faux titre de section « ##### FRANCE ##### » est filtré.
  await expect(page.locator('.column--channels')).not.toContainText('#####');
  // Pas de chaînes d'autres pays.
  await expect(page.locator('.column--channels')).not.toContainText('UK -');

  await expect(page.locator('.channel-info')).toContainText('Ensuite');

  await press(page, 'ArrowRight');
  await expect(page.locator('.column--groups')).toContainText('★ Favoris');
  await expect(page.locator('.channel-info')).toContainText('Favori');
});

test('télévision : numéros de chaînes, zapping et bandeau', async ({ page }) => {
  await onboard(page);
  await press(page, 'Enter');
  await expect(page.locator('.column--channels .row__number').first()).toHaveText('1');

  // Taper « 4 » : la chaîne n°4 se lance.
  await press(page, '4');
  await expect(page.locator('.channel-number')).toHaveText('4');
  await expect(page.locator('.column--channels .list__row--selected')).toContainText('Ciné Club');

  // OK sur la chaîne qui joue : plein écran ; ↓ zappe et affiche le bandeau.
  await press(page, 'Enter');
  await expect(page.locator('.tv--fullscreen')).toBeVisible();
  await press(page, 'ArrowDown');
  await expect(page.locator('.zap-banner')).toContainText('FR - Jeunesse');
  await expect(page.locator('.zap-banner__number')).toHaveText('5');
});

test('guide TV : grille, direct et replay', async ({ page }) => {
  await onboard(page);
  await press(page, 'Enter', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'Enter');
  await expect(page.getByRole('heading', { name: 'Guide TV' })).toBeVisible();
  await expect(page.locator('.guide__details-status')).toContainText('En direct');

  // ← : émission passée d'une chaîne avec replay.
  await press(page, 'ArrowLeft');
  await expect(page.locator('.guide__details-status')).toContainText('Replay disponible');
  await press(page, 'Enter');
  await expect(page.locator('.zap-banner')).toContainText('Replay');
});

test('YoumboFlix : rangées par genre et fiche film', async ({ page }) => {
  await onboard(page);
  await press(page, 'ArrowRight', 'Enter');

  await expect(rowTitles(page).first()).toHaveText('Récemment ajoutés');
  await expect(rowTitles(page).nth(1)).toHaveText('Action & Aventure');

  await press(page, 'ArrowDown');
  await activePosters(page);
  await press(page, 'Enter');
  await expect(page.locator('.detail__title')).toBeVisible();
  await expect(page.locator('.detail .menu__label')).toContainText(['Lecture', '♡ Ma liste']);

  // Ajout à Ma liste, puis retour : la rangée « Ma liste » apparaît en tête.
  await press(page, 'ArrowRight', 'Enter');
  await expect(page.locator('.detail .menu__label').nth(1)).toHaveText('♥ Dans ma liste');
  await press(page, 'Escape');
  await expect(rowTitles(page).first()).toHaveText('Ma liste');
});

test('YoumboFlix : séries par genre, saisons et épisodes', async ({ page }) => {
  await onboard(page);
  await press(page, 'ArrowRight', 'Enter');
  await expect(rowTitles(page).first()).toBeVisible();

  // ↑ vers les onglets, → Séries, ↓ dans les rangées.
  await press(page, 'ArrowUp', 'ArrowRight', 'ArrowDown');
  await expect(page.locator('.flix__tab--selected')).toHaveText('Séries');
  await expect(page.locator('.flix__rows')).toContainText('Séries 2026');

  await activePosters(page);
  await press(page, 'Enter');
  await expect(page.locator('.seasons__item').first()).toHaveText('Saison 1');
  await press(page, 'ArrowRight');
  await expect(page.locator('.seasons__item--selected')).toHaveText('Saison 2');
  await expect(page.locator('.detail .list__row').first()).toContainText('1. Épisode 1');
});

test('recherche dans la TV : chaînes seulement', async ({ page }) => {
  await onboard(page);
  // Catégories : Recherche, Guide TV, Toutes les chaînes… → deux fois ↑.
  await press(page, 'Enter', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'Enter');
  await expect(page.getByRole('heading', { name: 'Rechercher une chaîne' })).toBeVisible();

  await page.locator('.search__input').fill('chaine une');
  await expect(page.locator('.list__row').first()).toContainText('FR - Chaîne Une');
  await page.locator('.search__input').fill('phare');
  await expect(page.locator('.search__status')).toContainText('Aucun résultat');

  // ↓ puis OK sur une chaîne : elle se lance dans la TV.
  await page.locator('.search__input').fill('chaine une');
  await expect(page.locator('.list__row').first()).toContainText('Chaîne Une');
  await press(page, 'ArrowDown', 'Enter');
  await expect(page.locator('.column--channels .row__badge')).toBeVisible();
});

test('recherche dans YoumboFlix : films et séries seulement', async ({ page }) => {
  await onboard(page);
  await press(page, 'ArrowRight', 'Enter');
  await expect(rowTitles(page).first()).toBeVisible();
  await press(page, 'ArrowUp', 'ArrowRight', 'ArrowRight', 'Enter');
  await expect(
    page.getByRole('heading', { name: 'Rechercher un film ou une série' }),
  ).toBeVisible();

  await page.locator('.search__input').fill('phare');
  await expect(page.locator('.list__row').first()).toContainText('Le Phare');
  await page.locator('.search__input').fill('chaine une');
  await expect(page.locator('.search__status')).toContainText('Aucun résultat');

  // Retour : on revient dans YoumboFlix.
  await press(page, 'Escape');
  await expect(page.locator('.flix__brand')).toBeVisible();
});

test('paramètres : changer de pays', async ({ page }) => {
  await onboard(page);
  await press(page, 'ArrowRight', 'ArrowRight', 'Enter');
  await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible();

  await press(page, 'ArrowDown', 'Enter');
  await page.locator('.list__row', { hasText: 'Belgique' }).click();
  await expect(page.locator('.menu__detail').nth(1)).toHaveText('Belgique');

  await press(page, 'Escape', 'Enter');
  await expect(page.locator('.column--channels .row__label').first()).toHaveText(
    'BE - La Une Belge',
  );
});
