# M9 TCG (Trading Card Game)

C'est un jeu de collection de carte à jouer avec des intéraction entre les joueurs via une plateforme d'échange de carte (nomée le bazaard). Les joueurs peuvents obtenir ces cartes avec des boosters ainsi qu'avec un système de drop de carte périodique. Les cartes peuvent être utilisé pour jouer contre les autres collectionneurs.

Chaque joueurs possède leurs propre collection de carte à jouer et peuvent enchanger / vendre / acheter les cartes entre eux.

## Démarrer l'application

Prérequis : Docker Desktop démarré.

### Tester avec les images publiées

Cette commande utilise les deux images produites par la CI, sans `.env` ni configuration supplémentaire :

```bash
docker compose -f docker-compose.images.yaml up -d
```

#### Windows (environnement neuf)

Si tu veux lancer **seulement les conteneurs** (sans installer/cloner le code source), lance :

```powershell
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/xpelletier07/M9_TCG/main/set-up/Docker-Install/setup-docker-images-windows.ps1 -OutFile $env:TEMP\setup-m9-images.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\setup-m9-images.ps1"
```

Le script :
- vérifie Docker Desktop + Docker Compose + moteur Docker ;
- utilise `docker-compose.images.yaml` local s'il existe, sinon le télécharge automatiquement ;
- lance `docker compose` avec un nom de projet stable.

Si les images GHCR sont privées, connecte-toi d'abord :

```bash
docker login ghcr.io
```

#### Depuis la racine du dépôt (tous OS)

```bash
docker compose -f docker-compose.images.yaml up -d
```

### Développer et tester localement

Cette commande utilise les Dockerfiles et le code local, avec rechargement du client Vite :

```bash
docker compose up --build
```

Ouvrir ensuite [http://localhost:5173](http://localhost:5173). L'API est disponible sur [http://localhost:3000](http://localhost:3000).

Les deux modes configurent automatiquement la clé JWT et la base de données. Les données sont conservées dans le volume Docker `pgdata`.

Pour arrêter l'application :

```bash
docker compose down
```

## Comptes de démonstration

| Rôle | Nom d'utilisateur | Courriel | Mot de passe |
| --- | --- | --- | --- |
| Joueur (`actif`) | `demo-joueur` | `joueur.demo@m9tcg.local` | `joueur-demo-2026` |
| Administrateur (`admin`) | `demo-admin` | `admin.demo@m9tcg.local` | `admin-demo-2026` |

Le compte administrateur permet notamment de voir les contrôles d'ajout, de modification et de suppression des cartes dans la collection.

## Tests

À la racine du dépôt :

```bash
npm test
```

Cette commande construit le client puis exécute les tests du serveur.

## Ce qui est simulé dans l'alpha

- **Drop commun** : le compte à rebours est calculé sur un cycle local de 5 minutes et utilise une image de secours si aucun pack n'est disponible. Il sera remplacé par le système de drops partagés en temps réel au sprint 3.
- **Historique des combats** : le panneau affiche actuellement un état vide et le bouton `View All` n'ouvre pas encore de parcours. Il sera remplacé par le système de combat entre joueurs au sprint 3.
- **Bazaar** : la page est présente, mais les achats, les ventes et les échanges ne sont pas encore implémentés. Le Bazaar sera développé aux sprints 2 et 3.
- **Combat** : la page est présente comme point d'entrée, mais le parcours de combat n'est pas encore implémenté. Il sera livré au sprint 3.
