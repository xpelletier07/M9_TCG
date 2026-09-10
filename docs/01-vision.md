M9 — Présentation du projet
## Problématique

Les jeux et plusieurs sites de divertissement sont bloqués à l’école, ce qui limite les possibilités pour les élèves de se divertir pendant leurs temps libres.

Nous avons donc décidé de créer un jeu accessible aux élèves de Maisonneuve afin qu’ils puissent se divertir à l’école avec un jeu amusant et conçu spécialement pour eux.

## Utilisateurs

Les principaux utilisateurs de notre site sont les étudiants de Maisonneuve qui aiment collectionner des cartes et jouer avec celles-ci.

Certains utilisateurs peuvent également avoir le rôle d’administrateur afin de gérer les problèmes liés au site. Il peut notamment s’agir de professeurs ou de nous-mêmes, les développeurs du projet.

## Proposition de valeur

L’objectif est d’offrir une expérience de jeu de cartes et accessible aux étudiants de Maisonneuve pendant leurs temps libres.

## Portée du projet

### Inclus dans la portée

- Créer un compte et se connecter;
- Ouvrir des packs;
- Acheter, vendre et échanger des cartes;
- Système de ventes & achats dans le Bazaar;
- Gérer les comptes et le site avec un compte administrateur;
- Jouer en temps réel contre d’autres utilisateurs;
- Collectionner des cartes.

### Hors portée

- Le site est accessible uniquement aux étudiants et au personnel de Maisonneuve;
- Le nom ainsi que le titre du projet sont également réservés à notre classe pour des raisons de confidentialité;
- Interaction complexe entre **toutes** les différentes cartes lors des matchs;
- Parties disponnibles sur la version mobile.

6. Respect des exigences techniques

| # | Exigence | M9-TCG |
|---|---|---|
| 1 | Cadriciel *full stack*, rendu serveur et client | Serveur Node.js. Base de données PostGreSQL. Rendu côté client React. |
| 2 | Base de données transactionnelle | Serveur PostGreSQL |
| 3 | Installation et démarrage avec Docker | Setup Docker compose |
| 4 | Deux rôles derrière une authentification | Comptes utilisateurs et administrateurs |
| 5 | Fonctionnalité temps réel multi | Combat entre joueurs. ventes/achats au Bazaar. Drop de cartes commun |
| 6 | Point de concurrence réel | Drop de cartes commun. Prix au Bazaar |
| 7 | Tests automatisés à chaque poussée | GitHub Actions |
| 8 | Déploiement sur un serveur | Va déployé. |