## Rôles
| Sprint | Scrum master |
|--------|--------------|
| 1 | Marco |
| 2 | William |
| 3 | Lotfi |

**Product owner** : Xavier

## Rituels
- **Melee/Scrum**: Au début de chaque cours de Projet 3, nous allons nous rencontrer pendant 10 minutes debout.
- **Planification du sprint**: Au premier cours de chaque sprint, nous allons répartir les tâches à réaliser durant le sprint.
- **Revue/rétrospective**: Au dernier cours de chaque sprint, nous allons nous rencontrer pour discuter de toutes les choses qui se sont bien ou mal passées. Nous devons sortir de la rétrospective avec au **minimum** un point à changer/améliorer.
- **Communication hors des cours**: Tous les membres s'engagent à répondre dans le groupchat dans un délai maximal de 24hrs.
- **Communication du groupe**: Toutes les discussions concernant le projet devraient être dans le groupchat pour éviter de prendre des décisions où tous les membres ne sont pas au courant.
- **Retards**: Lorsqu'un membre de l'équipe sait qu'il va être en retard au cours de projet, il doit en informer les autres dès que possible.

## Définition de terminé
Nous considérons qu'un récit est terminé lorsque:
- Un autre membre de l'équipe à double check le pull request;
- Les tests automatisés couvrent le comportement ajouté;
- Tous les critères du récit sont accomplis;
- Associer chaque pull request à un récit lors de la completion;
- L'application démarre toujours avec le Docker après les modifications;
- Lors de la completion d'un épique ou récit important, avertir les autres membres de l'équipe dans le groupchat.

## Conventions
- Vérification du code par un autre membre de l'équipe lorsque le code est considéré comme étant terminé par le membre l'ayant écrit;
- Nommer les branches avec le numéro du ticket et description globale du récit. Ex: 3-recherche-artiste-titre;
- 2 branches principales resteront toujours: main & dev. Main sert comme branche de remise/production. Dev sert comme branche principale secondaire de développement du sprint. Les branches de développement des récits sont créées à partir de dev;
- Garder les commits simples. Un commit par fonctionnalité ajoutée. Généralement un verbe et courte description de l'ajout.

## Contribution individuelle
| Membre | Contributions à la soumission | 
|--------|-------------------------------|
| Alek | Rédaction des documents 02-backlog & 05-équipe. Double check de tous les autres documents.  |
| Lotfi | Rédaction des documents 01-vision & 04-sprint. Tests de postgresql & début du setup de la BD. |
| Marco | Rédaction du journal à chaque séance. Rédaction du document 06-risques. |
| Xavier | Conception des issues et setup du projet GitHub. Setup du Docker. Setup du CI/CD |
| William | Création du diagramme entité-relation. Rédaction du document 03-conception. |