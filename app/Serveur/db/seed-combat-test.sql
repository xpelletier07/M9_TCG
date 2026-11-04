-- Données de test du combat : créatures de démo, inventaires et decks pour demo-joueur et demo-admin.
-- Exécuté automatiquement à la création de la base, après seed.sql (monté sous le nom zz-seed-combat-test.sql
-- dans docker-compose.yaml et docker-compose.images.yaml). Pour retirer ces données : supprimer ce fichier
-- et ses deux références dans les fichiers docker-compose.
-- Ré-exécutable sur une base existante sans créer de doublons :
--   docker compose exec -T db psql -U postgres -d m9tcg < app/Serveur/db/seed-combat-test.sql
-- Stats selon le tableau de Combat.md : 2*mana/(atk+hp) ≈ 1 (commune), 0.5 (rare), 0.33 (épique), 0.5 (légendaire).

-- Créatures de démo
INSERT INTO carte (nom_carte, image, description, rarete, valeur, mana, health, damage)
SELECT v.nom_carte, v.image, v.description, v.rarete, v.valeur, v.mana, v.health, v.damage
FROM (VALUES
  ('Lutin des ruelles',    'https://picsum.photos/400/280?random=101', 'Petit, rapide et toujours affamé.',            1, 25,  1,  1,  1),
  ('Rat de bibliothèque',  'https://picsum.photos/400/280?random=102', 'Il a lu tous les livres, surtout la reliure.', 1, 25,  2,  2,  2),
  ('Garde du campus',      'https://picsum.photos/400/280?random=103', 'Personne ne passe sans sa carte étudiante.',   1, 25,  3,  4,  2),
  ('Archère du parc',      'https://picsum.photos/400/280?random=104', 'Elle vise juste, même sous la pluie.',         2, 50,  2,  5,  3),
  ('Golem de briques',     'https://picsum.photos/400/280?random=105', 'Construit avec les restes de l''aile B.',      2, 50,  4, 11,  5),
  ('Chevalier du métro',   'https://picsum.photos/400/280?random=106', 'Toujours à l''heure, jamais assis.',           1, 25,  5,  5,  5),
  ('Dragonnet du stade',   'https://picsum.photos/400/280?random=107', 'Crache des flammes à chaque but marqué.',      3, 75,  3, 10,  8),
  ('Sorcière des labos',   'https://picsum.photos/400/280?random=108', 'Ses potions ne passent jamais l''inspection.', 3, 75,  6, 21, 15),
  ('Titan de béton',       'https://picsum.photos/400/280?random=109', 'Il soutient le pont à lui seul.',              2, 50,  8, 18, 14),
  ('Nexus Prime',          'https://picsum.photos/400/280?random=110', 'Le gardien légendaire du réseau.',             4, 100, 10, 22, 18)
) AS v(nom_carte, image, description, rarete, valeur, mana, health, damage)
WHERE NOT EXISTS (SELECT 1 FROM carte c WHERE c.nom_carte = v.nom_carte);

-- Inventaire : 6 exemplaires de chaque créature de démo pour les deux comptes de démo
INSERT INTO inventaire_carte (id_utilisateur, id_carte, quantite)
SELECT u.id, c.id_carte, 6
FROM utilisateurs u
CROSS JOIN carte c
WHERE u.nom_utilisateur IN ('demo-joueur', 'demo-admin')
  AND c.nom_carte IN ('Lutin des ruelles', 'Rat de bibliothèque', 'Garde du campus', 'Archère du parc',
                      'Golem de briques', 'Chevalier du métro', 'Dragonnet du stade', 'Sorcière des labos',
                      'Titan de béton', 'Nexus Prime')
ON CONFLICT (id_utilisateur, id_carte)
DO UPDATE SET quantite = GREATEST(inventaire_carte.quantite, EXCLUDED.quantite);

-- Decks : « Deck Test » (50 cartes, valide) pour les deux comptes, « Deck Incomplet » (30 cartes) pour demo-joueur
INSERT INTO deck (id_utilisateur, nom_deck)
SELECT u.id, v.nom_deck
FROM (VALUES ('demo-joueur', 'Deck Test'), ('demo-admin', 'Deck Test'), ('demo-joueur', 'Deck Incomplet'))
  AS v(nom_utilisateur, nom_deck)
JOIN utilisateurs u ON u.nom_utilisateur = v.nom_utilisateur
WHERE NOT EXISTS (SELECT 1 FROM deck d WHERE d.id_utilisateur = u.id AND d.nom_deck = v.nom_deck);

INSERT INTO deck_carte (id_deck, id_carte, quantite)
SELECT d.id_deck, c.id_carte, v.quantite
FROM (VALUES
  ('Deck Test', 'Lutin des ruelles', 6),
  ('Deck Test', 'Rat de bibliothèque', 6),
  ('Deck Test', 'Garde du campus', 6),
  ('Deck Test', 'Archère du parc', 6),
  ('Deck Test', 'Golem de briques', 5),
  ('Deck Test', 'Chevalier du métro', 5),
  ('Deck Test', 'Dragonnet du stade', 5),
  ('Deck Test', 'Sorcière des labos', 4),
  ('Deck Test', 'Titan de béton', 4),
  ('Deck Test', 'Nexus Prime', 3),
  ('Deck Incomplet', 'Lutin des ruelles', 5),
  ('Deck Incomplet', 'Rat de bibliothèque', 5),
  ('Deck Incomplet', 'Garde du campus', 5),
  ('Deck Incomplet', 'Archère du parc', 5),
  ('Deck Incomplet', 'Golem de briques', 5),
  ('Deck Incomplet', 'Chevalier du métro', 5)
) AS v(nom_deck, nom_carte, quantite)
JOIN deck d ON d.nom_deck = v.nom_deck
JOIN utilisateurs u ON u.id = d.id_utilisateur AND u.nom_utilisateur IN ('demo-joueur', 'demo-admin')
JOIN carte c ON c.nom_carte = v.nom_carte
ON CONFLICT (id_deck, id_carte) DO NOTHING;
