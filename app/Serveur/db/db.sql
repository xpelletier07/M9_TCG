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
);

create table if not exists inventaire_carte (
    id_utilisateur int not null references utilisateurs(id) on delete cascade,
    id_carte int not null references carte(id_carte) on delete cascade,
    quantite int not null default 1 check (quantite > 0),
    primary key (id_utilisateur, id_carte)
);

create table if not exists deck (
    id_deck serial primary key,
    id_utilisateur int not null references utilisateurs(id) on delete cascade,
    nom_deck varchar(100) not null,
    cree_le timestamp not null default now()
);

create table if not exists deck_carte (
    id_deck int not null references deck(id_deck) on delete cascade,
    id_carte int not null references carte(id_carte) on delete cascade,
    quantite int not null default 1 check (quantite > 0),
    primary key (id_deck, id_carte)
);
