# Youmbo TV

Client IPTV léger pour les TV Samsung (Tizen) et le navigateur.

- **Stack** : TypeScript, [SolidJS](https://www.solidjs.com/) et [Vite](https://vite.dev/)
- **Lecture** : hls.js et mpegts.js dans le navigateur, puis le lecteur natif AVPlay sur TV (à venir)
- **Compatibilité** : le build vise Chromium 76 (Tizen 6, TV de 2021) et tourne donc aussi sur les modèles récents
- **Sources** : playlists M3U / M3U8 et API Xtream Codes (guide EPG XMLTV prévu)

> L'application ne fournit aucun contenu : tu y ajoutes ta propre playlist.

## Démarrer en local

Prérequis : Node.js 24 (voir `.nvmrc`).

```bash
npm install
npm run dev
```

Ouvre ensuite http://localhost:5173 et colle le lien de ta playlist M3U. Un lien Xtream (`get.php?username=…&password=…`) passe automatiquement par l'API Xtream, qui marche même quand le fournisseur bloque l'export M3U.

Pour ne pas le recoller à chaque fois, copie `.env.example` en `.env.local` et renseigne `M3U_URL`. Ce fichier est ignoré par Git : **ne commite jamais ton lien M3U**, il contient en général tes identifiants.

### Pourquoi un proxy en dev ?

Les serveurs IPTV n'envoient pas d'en-têtes CORS, donc un navigateur refuse de lire leurs playlists et leurs flux. En dev, toutes les requêtes passent par `/proxy?url=…`, servi par Vite sur ta machine (voir `tools/dev-proxy.ts`). Sur la TV, une app Tizen n'est pas soumise au CORS et appelle les URLs directement.

## Commandes

| Commande            | Rôle                             |
| ------------------- | -------------------------------- |
| `npm run dev`       | Serveur de dev avec rechargement |
| `npm run build`     | Build de production dans `dist/` |
| `npm test`          | Tests unitaires (Vitest)         |
| `npm run lint`      | ESLint                           |
| `npm run typecheck` | Vérification TypeScript          |
| `npm run format`    | Formatage Prettier               |

## Navigation

L'app se pilote entièrement au clavier, comme à la télécommande :

| Touche         | Action                                                     |
| -------------- | ---------------------------------------------------------- |
| ↑ / ↓          | Se déplacer dans la liste                                  |
| ← / →          | Passer d'une colonne à l'autre (pays, catégories, chaînes) |
| OK / Entrée    | Lire la chaîne (une seconde fois : plein écran)            |
| Retour / Échap | Quitter le plein écran / revenir aux catégories            |

## CI/CD

- **Pull request** : lint, format, types, tests, puis build. Le build est disponible en artefact.
- **Tag `v*`** : création d'une GitHub Release avec le build.
- **Dependabot** : mises à jour hebdomadaires des dépendances.

## Structure

```
src/
  core/      parsing M3U, réseau, stockage local
  player/    lecteur abstrait et implémentation navigateur
  ui/        composants (listes fenêtrées, écran de configuration)
tools/       outils de dev (proxy CORS)
```

## Playlist refusée ?

```bash
npm run diagnose
```

Lit `M3U_URL` dans `.env.local` (ou un lien passé en argument), affiche l'état du compte Xtream et teste le téléchargement direct avec plusieurs User-Agent. Le lien et les identifiants ne sont jamais affichés. Le User-Agent du proxy de dev se règle avec `PROXY_USER_AGENT`.
