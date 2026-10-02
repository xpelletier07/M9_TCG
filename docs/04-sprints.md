## Objectifs pour chaque sprint

| Sprint | Durée | Objectifs | Récits | Incrément démontrable |
|--------|-------|-----------|--------|-----------------------|
| 1 | ~3 semaines | Pages principales communes (login/signup, dashboard, inventaire) |  | Les utilisateurs peuvent s'inscrire, se connecter et voir les pages principales de l'app. |
| 2 | ~3 semaines | Fonctionnalités principales (Bazaar, finition inventaire, deck builder), 2FA |  | Les utilisateurs peuvent voir leur inventaire. Le Bazaar est mostly fonctionnel, sauf peut être pour la systématique temps réelle des prix. |
| 3 | ~5 semaines | Finition Bazaar. Système de drops. Système de combats. |  | Bazaar completement terminé. Le système de drops partagées est fonctionnel. Les combats dans l'arène sont possibles. |

## Capacité
| Élément | Calcul |
|---------|--------|
| Blocs de cours | 6 * 3h = 18h |
| Travail personnel | 3h/semaine * 3 semaines = 9h |
| Total par personne | 9 + 18 = 27h |
| Équipe de 5 | 27 * 5 = 135h |
| Moins rituels et autres légères pertes de temps (~25%) | 135 * 0.75 = 101h|
| Grand total | 101 heures de développement |

Puisque nous n'avons jamais tous travaillé ensemble, il est difficile de déterminer la cadence avec laquelle nous allons pouvoir travailler. Notre premier réflexe est de dire qu'une tâche normale (2 pts) équivaut environ à 3hrs de travail. Avec cet estimé, nous pouvons vaguement nous donner une charge d'environ 45 points. Nous réduisons aussi ce chiffre de -30% en prennant en compte notre optimisme, tel que recommandé par notre professeur et ses notes de cours.
( (101 / 1,5) * 2/3 = 44,44... ≈ 45) 

## Ordre d'abandon
| Priorité d'abandon | Issue | Raison | 
|---------|-------|--------|
| 1 | [#63](https://github.com/xpelletier07/M9_TCG/issues/63) | Cette fonctionnalité serait peut-être utile lors du déploiement global de l'application, mais elle est complêtement inutile pour notre objectifs actuelle (on ne demandra pas de vrai argent, pour le moment en tout cas). |
| 2 | [#62](https://github.com/xpelletier07/M9_TCG/issues/62) | Faire un système d'échange entre joueurs serait peu important contre le nombre de temps de développement qu'il va prendre à l'équipe |
| 3 | [#50](https://github.com/xpelletier07/M9_TCG/issues/50) | Ajouter des effets uniques au cartes serait une fonctionnalité incroyable mais coûteuse à produire. Malgré que cette fonctionnalité soit importante, elle n'est pas indispensable. |








## Objectif du sprint
Version alpha contenant les fonctionalitées primaires: login/signup, dashboard, drop de cartes simplifié (la matière du protocole WebSocket n'as pas été vue encore), catalogue de toutes les cartes, inventaire du joueur, sidebar pour naviguer entre les pages.

## Récits engagés
| Numéro Récit | Titre du Récit | Points | Commentaires |
|-----|-----|-----|-----|
| [#32](https://github.com/xpelletier07/M9_TCG/issues/32) | Formulaire d'inscription | 3 |  |
| [#34](https://github.com/xpelletier07/M9_TCG/issues/34) | Formulaire de connexion | 3-5 | Ce qui à été fait, est un 3, il manque juste le OF2, ce qui sera fait dans les prochains sprints |
| [#44](https://github.com/xpelletier07/M9_TCG/issues/44) | Navigation entre les pages | 3 | Inclus aussi le thème principal du site |
| [#48](https://github.com/xpelletier07/M9_TCG/issues/48) | Implémentation de l'inventaire | 3 |  |
| [#49](https://github.com/xpelletier07/M9_TCG/issues/49) | Implémentation des Decks | 2 |  |
| [#54](https://github.com/xpelletier07/M9_TCG/issues/54) | Système de booster périodiques | 3 |  |
| [#55](https://github.com/xpelletier07/M9_TCG/issues/55) | Système de drop communs | 8 | Placeholder pour l'instant, nous allons completer lorsque le protocole WebSocket sera vu en cours. Nous n'allons donc pas compter les points pour le sprint 1|
| [#57](https://github.com/xpelletier07/M9_TCG/issues/57) | Page de Catalogue - User | 5 |  |
| [#58](https://github.com/xpelletier07/M9_TCG/issues/58) | Page de Catalogue - Admin | 3 |  |
| [#71](https://github.com/xpelletier07/M9_TCG/issues/71) | Créer le Dashboard | 2 |  |

Grand total des points: 3 + 3 + 3 + 3 + 2 + 3 + 5 + 3 + 2 = 27

Notre estimé de base était de 45 points pour le sprint 1. Nous pouvons voir que l'estimé était extrêment optimiste et nous avons conclus que c'était en majeur partie dû à l'estimé de temps par point. Nous avions premièrement pensé à 1,5 hrs par point mais si nous recalculons avec 3hrs par point, on arrive à 23 points pour un sprint, ce qui est beaucoup plus proche de notre vélocité réelle. Nous estimons donc qu'en 3 semaines, en tant qu'équipe, nous pouvons completer l'équivalent de 25 points par sprint.
