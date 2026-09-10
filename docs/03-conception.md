## Modèle de donnée initial

Chemin menant au diagramme entité relation: ![Computer](diagrammes/v5diagramme_entite_relation.png)

## Routes principales


## Routes nécessaires pour faire fonctionner l'application:

### Page du Login/Signup:
- POST auth/login - utilise les informations pour se connecter dans un compte qui est présent aux databases.
- POST auth/signup - Crée un compte au database avec les informations implémenté. Le compte doit avoir un username, un email et un password.
- POST auth/check-email - Lors de la création du compte, cette route vérifie si l'email n'est pas déja présent dans le database.
    

### Autres fonctionalités d'utilisateurs:
- POST user/editCredits - Ajoute ou enlève des crédits du joueur sélectionné. Les crédits sont l'argent du site. Par exemple, si le joueur achète un booster pack, ça dépense de crédits.
- DELETE user/deleteAccount - Supprime le compte du database.

### Page Inventaire:
- GET inv/getCardsInventory - cherche tout les cartes que l'utilisateur possède en ce moment.
- GET inv/getdecks - Retourne tous les decks de l'utilisateur
- GET inv/getDeck/:id - Cherche les cartes que le joueur a préparé dans un deck spécifique pour qu'il les joueuent dans le match.
- POST inv/addCard/:idCarte - Ajoute une carte dans l'inventaire du joueur. L'id du joueur qui optient la carte et l'id de la carte sont obligatoires pour que la route marche.
- POST inv/addPack - Si l'utilisateur n'a pas de pack lors de l'exectuion de cette route, ça lui en ajoute un.
- POST inv/openPack - Ouvre un booster pack, et utilise la route inv/addCard pour ajouter des cartes dans l'inventaire du joueur.

### Page Catalogue des Cartes:
- GET data/getAllCards - cherche toutes les cartes du catalogue des cartes. Affiche les cartes en ordre alphabétique par tiers.
- GET data/getCard/:id - cherche une carte spécifique dans le catalogue des cartes.
- POST data/addCard - ajoute une nouvelle carte dans le catalogue des cartes. Seul un admin a le droit de faire cela, retourne une erreur si l'utilisateur n'est pas un admin.
- DELETE data/deleteCard - supprime une carte dans le database des cartes. Seul un admin a le droit de faire cela, retourne une erreur si l'utilisateur n'est pas un admin.

### Page Match:
- POST match/queue/addUserToQueue - Ajoute un utilisateur dans la liste de personnes qui veut faire un match contre un autre joueur.
- POST match/startMatch - Ajoute deux utilisateurs, puis démarre le match.    
- POST match/engageCard - Engage la carte dans le match.
- POST match/triggerAbility - Trigger l'ability d'une carte.
- POST match/stats/hpChangeCard - Route pour enlever ou ajouter des points de vies a la carte. Par exemple, quand la carte attaque l'autre carte, l'autre carte reçevera -5 points de vies.
- POST match/stats/hpChangePlayer - Route pour enlever ou ajouter des points de vies au joueur.

### Page Bazaar:
- GET market/bazaar/getPrices/:idCarte - Liste les détails des prix d'une carte spécifique.
- POST market/bazaar/createSellOrder - Ajoute une offre de vente pour un magasin. Enlève la carte de l'inventaire, et quand le buy est complèté, les crédits sont ajoutés automatiquement a l'inventaire du joueur.
- POST market/bazaar/buy - Conlue la vente, transactionne les crédits de l'acheteur au vendeur, et la carte du vendeur vient a l'acheteur. Ajoute aussi un log de transaction que les admins peuvent voir.
- DELETE market/bazaar/removeOffer - Enlève un offre. Quand l'offre de vente est annulé, retourne la carte au joueur.

### Middlewares:
- checkAdmin - Regarde si l'utilisateur est un admin ou pas. Si il est admin, return True. Sinon, return False.

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