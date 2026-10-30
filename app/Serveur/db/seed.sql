-- Données de démonstration.
-- Exécuté automatiquement par PostgreSQL (docker-entrypoint-initdb.d) uniquement
-- lors de la toute première création de la base de données, juste après db.sql
-- (les fichiers sont exécutés par ordre alphabétique : db.sql puis seed.sql).
-- Pour le rejouer, il faut supprimer le volume : docker compose down -v

-- Comptes de démonstration
INSERT INTO utilisateurs
  (nom_utilisateur, email, mot_de_passe_hash, statut, credits)
VALUES
  ('demo-joueur', 'joueur.demo@m9tcg.local', '$2b$10$uWXDSzG.Ij2gErVSwwgQl.Q23..Jyoc48IAbbeVMEVGlVHMj.TdWC', 'actif', 1000),
  ('demo-admin', 'admin.demo@m9tcg.local', '$2b$10$8HEhcGOoGh.LR6EAev7.y.sLy7AQ5TpAI/d/fTz2W896Y8FkwRopG', 'admin', 1000)
ON CONFLICT DO NOTHING;

-- Cartes de démonstration
INSERT INTO carte
  (nom_carte, image, description, rarete, valeur, mana, health, damage)
VALUES
  ('Carte Démo 1', 'https://picsum.photos/400/280?random=89', 'Description de la carte démo 1', 1, 10, 1, 5, 2),
  ('Carte Démo 2', 'https://picsum.photos/400/280?random=90', 'Description de la carte démo 2', 2, 20, 2, 10, 4),
  ('Carte Démo 3', 'https://picsum.photos/400/280?random=91', 'Description de la carte démo 3', 3, 30, 3, 15, 6);

INSERT INTO Packs
  (nom_pack, image_pack, description_pack, liste_carte, valeur)
values
  ('Belle pro moment', 'https://imgs.search.brave.com/AplNxDUoDF5PCln6JDPv-aEbINciPiMK9IOYTuqg4VA/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9zdGF0/aWMud2l4c3RhdGlj/LmNvbS9tZWRpYS82/ZmU5ODNfN2FkMDNk/M2U1ZTM5NDg2ZTg4/N2Y5NDQwNWMxYjZj/ODB-bXYyLnBuZy92/MS9maWxsL3dfOTgw/LGhfNjUzLGFsX2Ms/cV85MCx1c21fMC42/Nl8xLjAwXzAuMDEs/ZW5jX2F2aWYscXVh/bGl0eV9hdXRvL2xv/Z28lMjBMYSUyMGJl/bGxlJTIwUHJvdmlu/Y2UlMjBBdXRoZXRp/cXVlLnBuZw',
  'You found me in a belle pro moment of my life', ARRAY[1, 2, 3], 10)
ON CONFLICT DO NOTHING;