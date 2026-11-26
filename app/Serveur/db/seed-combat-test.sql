-- Données de test du combat : créatures de démo, inventaires et decks pour demo-joueur et demo-admin.
-- Exécuté automatiquement à la création de la base, après seed.sql (monté sous le nom zz-seed-combat-test.sql
-- dans docker-compose.yaml et docker-compose.images.yaml). Pour retirer ces données : supprimer ce fichier
-- et ses deux références dans les fichiers docker-compose.
-- Ré-exécutable sur une base existante sans créer de doublons :
--   docker compose exec -T db psql -U postgres -d m9tcg < app/Serveur/db/seed-combat-test.sql
-- Stats selon le tableau de Combat.md : 2*mana/(atk+hp) ≈ 1 (commune), 0.5 (rare), 0.33 (épique), 0.5 (légendaire).

-- Colonne des capacités (déjà créée par db.sql sur une nouvelle base ; ajoutée ici pour une base existante)
ALTER TABLE carte ADD COLUMN IF NOT EXISTS capacites jsonb NOT NULL DEFAULT '{}'::jsonb;

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

-- Légendaires de démo : ensemble avec Nexus Prime, elles couvrent les 11 capacités de Combat.md
INSERT INTO carte (nom_carte, image, description, rarete, valeur, mana, health, damage)
SELECT v.nom_carte, v.image, v.description, 4, 100, v.mana, v.health, v.damage
FROM (VALUES
  ('Gardien du pavillon',  'https://picsum.photos/400/280?random=111', 'Il ne laisse passer personne.',                5, 13,  7),
  ('Faucon de la tour',    'https://picsum.photos/400/280?random=112', 'Il plonge du toit avant que tu le voies.',     4,  7,  9),
  ('Spectre des archives', 'https://picsum.photos/400/280?random=113', 'Chaque dossier oublié le rend plus fort.',     6, 12, 12),
  ('Tempête du quad',      'https://picsum.photos/400/280?random=114', 'Le vent du quadrilatère n''épargne personne.', 7, 14, 14)
) AS v(nom_carte, image, description, mana, health, damage)
WHERE NOT EXISTS (SELECT 1 FROM carte c WHERE c.nom_carte = v.nom_carte);

-- Capacités des légendaires, données seulement si la carte n'en a pas déjà (modifications de l'admin conservées)
UPDATE carte c
SET capacites = v.capacites::jsonb
FROM (VALUES
  ('Gardien du pavillon',  '{"provocation": true, "bouclier": 2}'),
  ('Faucon de la tour',    '{"vol": true, "haste": true}'),
  ('Spectre des archives', '{"toxique": true, "drain_de_vie": true}'),
  ('Tempête du quad',      '{"intimidation_de_masse": 2, "ralliement": 1}'),
  ('Nexus Prime',          '{"pioche": 2, "inspiration": 3, "intimidation": 3}')
) AS v(nom_carte, capacites)
WHERE c.nom_carte = v.nom_carte AND c.capacites = '{}'::jsonb;

-- Inventaire : 6 exemplaires de chaque créature de démo pour les deux comptes de démo
INSERT INTO inventaire_carte (id_utilisateur, id_carte, quantite)
SELECT u.id, c.id_carte, 6
FROM utilisateurs u
CROSS JOIN carte c
WHERE u.nom_utilisateur IN ('demo-joueur', 'demo-admin')
  AND c.nom_carte IN ('Lutin des ruelles', 'Rat de bibliothèque', 'Garde du campus', 'Archère du parc',
                      'Golem de briques', 'Chevalier du métro', 'Dragonnet du stade', 'Sorcière des labos',
                      'Titan de béton', 'Nexus Prime', 'Gardien du pavillon', 'Faucon de la tour',
                      'Spectre des archives', 'Tempête du quad')
ON CONFLICT (id_utilisateur, id_carte)
DO UPDATE SET quantite = GREATEST(inventaire_carte.quantite, EXCLUDED.quantite);

-- Decks : « Deck Test » et « Deck Légendaire » (50 cartes, valides) pour les deux comptes,
-- « Deck Incomplet » (30 cartes) pour demo-joueur. Un nouveau deck plutôt qu'une modification de « Deck Test »,
-- pour que ce fichier reste ré-exécutable sans dépasser 50 cartes sur une base existante.
INSERT INTO deck (id_utilisateur, nom_deck)
SELECT u.id, v.nom_deck
FROM (VALUES ('demo-joueur', 'Deck Test'), ('demo-admin', 'Deck Test'), ('demo-joueur', 'Deck Incomplet'),
             ('demo-joueur', 'Deck Légendaire'), ('demo-admin', 'Deck Légendaire'))
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
  ('Deck Légendaire', 'Lutin des ruelles', 6),
  ('Deck Légendaire', 'Rat de bibliothèque', 6),
  ('Deck Légendaire', 'Garde du campus', 6),
  ('Deck Légendaire', 'Archère du parc', 6),
  ('Deck Légendaire', 'Golem de briques', 5),
  ('Deck Légendaire', 'Chevalier du métro', 5),
  ('Deck Légendaire', 'Dragonnet du stade', 4),
  ('Deck Légendaire', 'Sorcière des labos', 2),
  ('Deck Légendaire', 'Titan de béton', 2),
  ('Deck Légendaire', 'Gardien du pavillon', 2),
  ('Deck Légendaire', 'Faucon de la tour', 2),
  ('Deck Légendaire', 'Spectre des archives', 2),
  ('Deck Légendaire', 'Tempête du quad', 2),
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
