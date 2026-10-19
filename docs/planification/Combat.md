### Mana
Le mana commence à 1 et augmente de 1 à chaque tour jusqu'à 10 (tour 2 = 2 mana, tour 3 = 3 mana, etc.). Chaque carte a un coût de mana qui lui est relié, les cartes plus fortes couttent généralement plus de mana. Au début de chaque tour, le joueur reprends tout son mana (ex: avait 1/3 mana au dernier tour, prochain tour il a 4/4).

### Vie
Chaque carte a sa propre valeur de vie et chaque joueur a aussi une vie pour la partie. Lorsque la vie d'un des joueurs tombe à 0, il perd.

### Turn order
Au début de la partie, un coin flip est fait pour déterminer quel joueur commence en premier. Au début de chaque tour le joueur pige une carte de son deck. Il peut ensuite jouer autant de cartes qu'il veut/peut, jusqu'à ce qu'il n'ait plus de cartes dans les mains ou plus de mana. Un joueur peut aussi décider de finir son tour à n'importe quel moment à l'aide d'un boutton à l'écran.

### Fin de partie
Une partie se termine lorsque la vie d'un des joueurs atteint 0, lorsqu'un joueur doit piger (au début de son tour ou avec un effet de carte), ou si un joueur abandonne la partie.

### Valeurs/Balancing
Toutes les valeurs vont être déterminées de façon arbitraire. En règle générale on veut suivre la formule :
$$\frac{2 * mana }{atk + hp}$$
Cette formule devrait atteindre une valeur différente selon la rareté de la carte. Les cartes légendaires doivent avoir une valeur un peu moins élevée puisqu'elles auront des effets et ceux-ci doivent être pris en compte pour le balancement. 
| Variable | Valeur attribuée |
| ----- | ----- |
| Vie du joueur | 50 |
| Nbre cartes dans un deck | 50 |
| Valeur de la formule pour cartes communes | 1 |
| Valeur de la formule pour cartes rares | 0.5 |
| Valeur de la formule pour cartes épiques | 0.33 |
| Valeur de la formule pour cartes légendaires | 0.5 |
| Crédits de départ pour un nouveau compte | 500 |
| Prix de base d'une carte commune | 25 |
| Prix de base d'une carte rare | 50 |
| Prix de base d'une carte épique | 75 |
| Prix de base d'une carte légendaire | 100 |
