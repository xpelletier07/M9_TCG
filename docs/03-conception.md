## Modèle de donnée initial

Chemin menant au diagramme entité relation: ![Computer](diagrammes/v6.drawio.png)

## Routes principales


## Routes nécessaires pour faire fonctionner l'application:

### Page du Login/Signup (`/auth`):
- POST /auth/signup — Crée un compte dans la base de données (nom d'utilisateur, email, mot de passe hashé avec bcrypt).
- POST /auth/login — Vérifie les identifiants et retourne un token JWT (expire après 2h).
- POST /auth/check-email — Lors de la création du compte, vérifie si l'email n'est pas déjà présent dans la base.
- GET /auth/whoAmI — (protégée, `checkAuth`) Retourne les infos de l'utilisateur connecté.
- PUT /auth/makeMeAdmin — (protégée, `checkAuth`) Route temporaire de test qui donne le statut admin à l'utilisateur connecté, à retirer une fois la gestion des rôles finalisée.

### Page Catalogue des Cartes (`/collection`):
- GET /collection/all — (protégée, `checkAuth`) Retourne toutes les cartes du catalogue.
- GET /collection/:id — (protégée, `checkAuth`) Retourne une carte spécifique du catalogue.
- POST /collection/card — (admin seulement, `checkAdmin`) Ajoute une nouvelle carte au catalogue (champs validés avec express-validator).
- PATCH /collection/:id — (admin seulement, `checkAdmin`) Modifie une carte existante.
- DELETE /collection/:id — (admin seulement, `checkAdmin`) Supprime une carte du catalogue.

### Page Inventaire / Decks (`/inventory`):
- GET /inventory/cards — Retourne toutes les cartes que l'utilisateur possède, avec leur quantité.
- GET /inventory/decks — Retourne la liste des decks de l'utilisateur (avec le total de cartes par deck).
- GET /inventory/decks/:id — Retourne le détail d'un deck spécifique (cartes incluses), pour le jouer en match.
- POST /inventory/decks — Crée un nouveau deck (nom requis, maximum 30 caractères).
- PATCH /inventory/decks/:id — Renomme un deck existant.
- DELETE /inventory/decks/:id — Supprime un deck.
- POST /inventory/decks/:id/cards/:idCarte — Ajoute une quantité d'une carte de l'inventaire dans un deck (vérifie que le joueur possède assez de cette carte).
- DELETE /inventory/decks/:id/cards/:idCarte — Retire une carte d'un deck.

### Routes additionnelles (sans préfixe commun, définies dans `routes/carte.js` et `routes/inventaire.js`):
- GET /api/card/:id — Retourne une carte spécifique (route simplifiée, redondante avec /collection/:id).
- GET /inventaire/:id_user — Retourne l'inventaire brut d'un utilisateur selon son id.
- POST /carteInventaire/:id_user/:id_carte — Ajoute une carte à l'inventaire d'un utilisateur.
- DELETE /carteInventaire/:id_user/:id_carte — Supprime une carte de l'inventaire d'un utilisateur.

### Connexion avec GitHub (`/auth/github`, `routes/githubAuth.js`):
- GET /auth/github — Redirige l'utilisateur vers GitHub pour qu'il autorise l'application (un `state` stocké dans un cookie protège contre le CSRF). Redirige avec une erreur si `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` ne sont pas configurés.
- GET /auth/github/callback — Reçoit le retour de GitHub, vérifie le `state`, échange le code contre un jeton GitHub, lit le profil et les courriels, crée ou retrouve le compte (colonne `github_id` de la table des utilisateurs), puis génère notre propre JWT.

Déroulement du flux:
1. Le client redirige vers `GET /auth/github` (serveur).
2. Le serveur redirige vers GitHub, qui demande l'autorisation à l'utilisateur.
3. GitHub rappelle `GET /auth/github/callback` (serveur).
4. Le serveur redirige vers la page client `/auth/github/callback#token=...`. Le JWT est dans le fragment (`#`) pour ne jamais apparaître dans les logs serveur. La page `GithubCallback.jsx` le récupère et connecte l'utilisateur.
5. En cas d'échec, le serveur redirige vers `/login?error=<code>` (`github_refuse`, `state_invalide`, `echange_code_echoue`, `profil_github_indisponible`, `erreur_serveur`, `github_non_configure`).

Configuration requise (variables d'environnement): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `CLIENT_URL`.

### Packs (`/pack`, `routes/packs.js`):
- GET /pack — Retourne tous les packs.
- POST /pack — Crée un pack (nom, image, description, liste de cartes, valeur, actif).
- PUT /pack/:id — Modifie un pack.
- DELETE /pack/:id — Supprime un pack.
- Note: ces routes n'ont pas de `checkAuth` / `checkAdmin` pour l'instant.

### Packs de l'utilisateur et drop (`/inventaire-pack`, `routes/inventairePack.js`):
- GET /inventaire-pack/drop-state — Retourne l'état du drop global (cycle de 5 minutes): secondes restantes, date de réinitialisation et pack du cycle courant.
- POST /inventaire-pack/heartbeat — (protégée, `checkAuth`) Signale que l'utilisateur est actif pour le drop.
- GET /inventaire-pack/status — (protégée, `checkAuth`) Retourne l'état du cooldown de 24 h pour réclamer un pack (`canClaim`, temps restant) et les packs de l'utilisateur.
- POST /inventaire-pack/open et POST /inventaire-pack/claim — (protégées, `checkAuth`, même traitement) Réclame un pack (1 fois par 24 h) et l'ajoute à l'inventaire. Retourne 429 si le cooldown n'est pas terminé.
- GET /inventaire-pack — Retourne les packs possédés.
- POST /inventaire-pack — Ajoute des packs à un utilisateur (`id_utilisateur`, `id_pack`, `quantite` validés avec express-validator).

### Routes de diagnostic (`app.js`):
- GET / — Vérifie que l'API est en ligne.
- GET /health — Healthcheck simple (utilisé par le CI/Docker).
- GET /api/db-check — Vérifie que la connexion à la base de données fonctionne.
- GET /api/drop-timer — Retourne le temps restant avant le prochain drop (cycle de 5 minutes).

### Combat en temps réel (Socket.IO, `realtime.js`):
- Le combat passe par Socket.IO plutôt que par des routes REST. Une salle (`matchId`) accepte 2 joueurs maximum.
- Événements envoyés par le client: `combat:join`, `combat:leave`, `combat:ready`, `combat:action`, `combat:message`.
- Événements reçus par le client: `combat:connected`, `combat:joined`, `combat:left`, `combat:player-joined`, `combat:player-left`, `combat:room-state`, `combat:started` (quand les deux joueurs sont prêts), `combat:action`, `combat:message`, `combat:error`.

### Autres fonctionalités d'utilisateurs:
- POST user/editCredits — Ajoute ou enlève des crédits du joueur sélectionné. Les crédits sont l'argent du site. Par exemple, si le joueur achète un booster pack, ça dépense de crédits.
- DELETE user/deleteAccount — Supprime le compte du database.

### Page Match:
- POST match/queue/addUserToQueue — Ajoute un utilisateur dans la liste de personnes qui veut faire un match contre un autre joueur.
- POST match/startMatch — Ajoute deux utilisateurs, puis démarre le match.    
- POST match/engageCard — Engage la carte dans le match.
- POST match/triggerAbility — Trigger l'ability d'une carte.
- POST match/stats/hpChangeCard — Route pour enlever ou ajouter des points de vies a la carte. Par exemple, quand la carte attaque l'autre carte, l'autre carte reçevera -5 points de vies.
- POST match/stats/hpChangePlayer — Route pour enlever ou ajouter des points de vies au joueur.

### Page Bazaar:
- GET market/bazaar/getPrices/:idCarte — Liste les détails des prix d'une carte spécifique.
- POST market/bazaar/createSellOrder — Ajoute une offre de vente pour un magasin. Enlève la carte de l'inventaire, et quand le buy est complèté, les crédits sont ajoutés automatiquement a l'inventaire du joueur.
- POST market/bazaar/buy — Conlue la vente, transactionne les crédits de l'acheteur au vendeur, et la carte du vendeur vient a l'acheteur. Ajoute aussi un log de transaction que les admins peuvent voir.
- DELETE market/bazaar/removeOffer — Enlève un offre. Quand l'offre de vente est annulé, retourne la carte au joueur.

### Middlewares (`middlewares/checkAuth.js`):
- checkAuth — Vérifie qu'un token JWT valide est fourni dans l'en-tête `Authorization`. Si valide, attache l'utilisateur à `req.user` et laisse passer la requête.
- checkAdmin — Vérifie qu'un token JWT valide est fourni et que l'utilisateur a le statut "admin". Si il est admin, laisse passer la requête. Sinon, retourne une erreur 403.



## Registre des décisions:

### Décision 1 | Quel modèle de base de données utiliser?
- **La question**: Quel modèle de base de données devrions nous utiliser? Continuer avec ce que nous avons appris et sommes à l'aise (MSSQL) ou apprendre un nouveau modèle qui serait possiblement plus simple à setup pour le docker (PostGreSQL)
- **Options envisagées**: MSSQL & PostGreSQL
- **Décision**: PostGreSQL
- **Raison**: L'apprentissage de ce nouveau modèle de base de donnée est assez similaire à celui que nous connaissons et son implémentation dans Docker est très simple, nous sauvant du temps à la longue.
- **Ce que ça coûte**: Apprendre les particularités de PostGreSQL, ce qui devrait être relativement simple surtout que nous connaissons les concepts des bases de données relationnelles.

### Décision 2 | Structure du projet
- **La question**: Comment structurer les récits et tâches à accomplir?
- **Options envisagées**: Épiques -> Récits -> Issue -> Sub-issue vs Issues -> Sub-issues
- **Décision**: É -> R -> I -> S-I
- **Raison**: L'ajout des épiques et récits rends les concepts plus clairs et permets une meilleure interprétation pour les décisions techniques lors du développement.
- **Ce que ça coûte**: Plus de développement des idées lors de l'élaboration du projet. Cela nous prends plus de temps que de faire des tickets/issues uniques.

### Décision 3 | Hosting
- **La question**: Quel service de hosting utiliser? 
- **Options envisagées**: Render ou Microsoft Azure
- **Décision**: Microsoft Azure
- **Raison**: Render n'offre pas assez de bonnes performances pour les besoins de notre projet donc nous allons aller vers Microsoft Azure.
- **Ce que ça coûte**: Le serveur ne pourra être hosté que lorsqu'on est étudiant et après nous devrons payer ou l'annuler.

## Nouvelles décisions prises durant le sprint 1

### Changements Sprint 0 -> 1
- Plusieurs nom de routes ont étés changées puisque nous utilisions des verbes dans le nom des routes. Après rétroaction du prof, nous avons suivi son conseil de laisser les méthodes HTTP parler d'elles mêmes.

### Décision 4 | Hiérarchie des fichiers
- **La question**: Comment organiser tous les fichiers
- **Options envisagées**: Une infinitée de différentes façons d'organiser les dossiers
- **Décision**: Serveur -> middlewares/ | routes/ | Router/ | tests/ | db/
                Client -> auth/ | components/ | pages/ | css/ | Routeur.jsx 
- **Raison**:   Organise les fichiers dans des catégories de tailles raisonnables, sans avoir des milliers de dossiers à naviguer.
- **Ce que ça coûte**: Une grosse perte de temps parce que Windows pense que "Pages" === "pages" donc il y avait une duplication des fichiers et des dossiers dans GitHub.

### Décision 5 | Démarrage de l'application
- **La question**: Comment démarrer le client, le serveur et la base de données de façon identique sur toutes les machines?
- **Options envisagées**: Démarrer chaque service à la main (`npm start` + PostgreSQL installé localement) vs Docker Compose
- **Décision**: Docker Compose, avec deux modes: `docker compose up --build` (code local, rechargement Vite) et `docker compose -f docker-compose.images.yaml up -d` (images publiées par la CI)
- **Raison**: Une seule commande lance les trois services (client sur `localhost:5173`, API sur `localhost:3000`, PostgreSQL sur `localhost:5432`). La base est initialisée automatiquement avec `db/db.sql` et les données sont conservées dans le volume `pgdata`. Aucun `.env` n'est requis pour démarrer.
- **Ce que ça coûte**: Docker Desktop doit être installé et démarré. Le premier build est plus long.

### Note | Nom de la branche du journal
- La branche distante s'appelle `Journal` (majuscule) alors que la branche locale s'appelle `journal`. Git est sensible à la casse côté serveur, donc `git pull origin journal` échouait avec « couldn't find remote ref journal ». Correction: `git branch --set-upstream-to=origin/Journal journal`, puis `git pull origin Journal`.





