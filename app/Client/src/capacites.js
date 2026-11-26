// Catalogue des capacités côté client : libellés, icônes et texte des capacités de Combat.md.
// Miroir de app/Serveur/game/capacites.js (les ids doivent rester identiques, vérifié par les tests serveur).
// Module pur : aucun import React ni Vite (il est aussi importé par les tests Node).

// Dans l'ordre de Combat.md ; `gradue` : la capacité a un niveau X
export const CAPACITES_INFO = {
    haste: { nom: 'Haste', icone: '⚡', gradue: false, description: () => 'Peut attaquer dès le tour où elle est jouée.' },
    toxique: { nom: 'Toxique', icone: '☠', gradue: false, description: () => 'Toute créature à qui elle inflige des dégâts au combat meurt.' },
    bouclier: { nom: 'Bouclier', icone: '✨', gradue: true, description: (n) => `Bloque les ${n} prochaine${n > 1 ? 's' : ''} instance${n > 1 ? 's' : ''} de dégâts.` },
    provocation: { nom: 'Provocation', icone: '🛡', gradue: false, description: () => 'L’adversaire doit l’attaquer avant tes autres créatures (et avant toi).' },
    inspiration: { nom: 'Inspiration', icone: '🌟', gradue: true, description: (n) => `En jeu : donne +${n}/+${n} à une créature alliée de ton choix.` },
    ralliement: { nom: 'Ralliement', icone: '📯', gradue: true, description: (n) => `En jeu : donne +${n}/+${n} à tes autres créatures.` },
    intimidation: { nom: 'Intimidation', icone: '👁', gradue: true, description: (n) => `En jeu : donne -${n}/-${n} à une créature adverse de ton choix.` },
    intimidation_de_masse: { nom: 'Intimidation de masse', icone: '💀', gradue: true, description: (n) => `En jeu : donne -${n}/-${n} à toutes les créatures adverses.` },
    vol: { nom: 'Vol', icone: '🪽', gradue: false, description: () => 'Peut attaquer le joueur en ignorant les créatures terrestres (pas celles avec Vol ou Provocation).' },
    drain_de_vie: { nom: 'Drain de vie', icone: '🩸', gradue: false, description: () => 'Les dégâts qu’elle inflige au combat soignent son joueur.' },
    pioche: { nom: 'Pioche', icone: '🂠', gradue: true, description: (n) => `En jeu : pioche ${n} carte${n > 1 ? 's' : ''}.` },
}

// Capacités qui demandent au joueur de choisir une créature quand il joue la carte
export const CAPACITES_CIBLEES = {
    inspiration: 'allie',
    intimidation: 'adverse',
}

export const NIVEAU_MIN = 1
export const NIVEAU_MAX = 5
export const RARETE_CAPACITES = 4

export function niveauCapacite(carte, id) {
    const valeur = carte?.capacites?.[id]
    if (valeur === true) return 1
    return Number.isInteger(valeur) && valeur > 0 ? valeur : 0
}

export function aCapacite(carte, id) {
    return niveauCapacite(carte, id) > 0
}

// Capacités connues d'une carte, dans l'ordre du catalogue : [{ id, niveau, nom, icone, gradue, texte }]
export function lireCapacites(carte) {
    return Object.entries(CAPACITES_INFO)
        .filter(([id]) => aCapacite(carte, id))
        .map(([id, info]) => {
            const niveau = niveauCapacite(carte, id)
            return { id, niveau, nom: info.nom, icone: info.icone, gradue: info.gradue, texte: info.description(niveau) }
        })
}

// Objet { id: true | niveau } des capacités connues de la carte (pour l'éditeur et l'API)
export function extraireCapacites(carte) {
    return Object.fromEntries(lireCapacites(carte).map(({ id, gradue, niveau }) => [id, gradue ? niveau : true]))
}

export function aDesCapacites(carte) {
    return lireCapacites(carte).length > 0
}

// Nom affiché : « Inspiration 3 », « Vol »
export function libelleCapacite({ nom, gradue, niveau }) {
    return gradue ? `${nom} ${niveau}` : nom
}

// Capacités ciblées à résoudre quand la carte est jouée, seulement si une créature peut être visée
export function etapesCiblage(carte, monTerrain, terrainAdverse) {
    return Object.entries(CAPACITES_CIBLEES)
        .filter(([id, camp]) => aCapacite(carte, id) && (camp === 'allie' ? monTerrain : terrainAdverse).length > 0)
        .map(([id]) => id)
}
