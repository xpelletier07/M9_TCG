-- Script d'initialisation exécuté automatiquement au premier démarrage
-- du conteneur PostgreSQL (via docker-entrypoint-initdb.d).
-- Ajoutez ici vos tables au fur et à mesure du développement.

CREATE TABLE IF NOT EXISTS utilisateurs (
    id SERIAL PRIMARY KEY,
    nom_utilisateur VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    cree_le TIMESTAMP NOT NULL DEFAULT NOW()
);

-- table pour les cartes
create table if not exists carte (
    id_carte serial primary key,
    nom_carte varchar(255) not null,
    image varchar(255) not null,
    description varchar(255),
    rarete int not null,
    valeur float not null,
    mana int not null,
    health int not null,
    damage int not null
)


