// Catalogue fermé des capacités spéciales (docs/planification/Combat.md) et validation de leur forme.
// Une carte stocke { [id]: true | niveau } (colonne jsonb), ex. { "vol": true, "inspiration": 3 }.
// Une capacité est soit présente ou non (true), soit graduée par un niveau X entre NIVEAU_MIN et NIVEAU_MAX.
// Miroir côté client : app/Client/src/capacites.js (les ids doivent rester identiques, voir tests/capacites.test.js).

// id -> graduée (true) ou non (false), dans l'ordre de Combat.md
export const CAPACITES = {
    haste: false,
    toxique: false,
    bouclier: true,
    provocation: false,
    inspiration: true,
    ralliement: true,
    intimidation: true,
    intimidation_de_masse: true,
    vol: false,
    drain_de_vie: false,
    pioche: true,
}

// Capacités qui demandent au joueur de choisir une créature quand il joue la carte
export const CAPACITES_CIBLEES = {
    inspiration: "allie",
    intimidation: "adverse",
}

export const NIVEAU_MIN = 1
export const NIVEAU_MAX = 5
// Pour l'instant, seules les légendaires peuvent avoir des capacités
export const RARETE_CAPACITES = 4

// Forme canonique : objet simple, valeurs true ou nombre ; ne valide pas le contenu (voir validerCapacites)
export function normaliserCapacites(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {}
    const capacites = {}
    for (const [id, valeur] of Object.entries(input)) {
        if (valeur === false || valeur === null || valeur === undefined) continue
        capacites[id] = valeur === true ? true : Number(valeur)
    }
    return capacites
}

export function aDesCapacites(capacites) {
    return Object.keys(normaliserCapacites(capacites)).length > 0
}

// Niveau d'une capacité sur une carte : 0 si absente, 1 pour une capacité non graduée
export function niveauCapacite(card, id) {
    const valeur = card?.capacites?.[id]
    if (valeur === true) return 1
    return Number.isInteger(valeur) && valeur > 0 ? valeur : 0
}

export function aCapacite(card, id) {
    return niveauCapacite(card, id) > 0
}

// Liste des erreurs (en français) ; vide si les capacités sont valides pour cette rareté
export function validerCapacites(capacites, rarete) {
    const normalisees = normaliserCapacites(capacites)
    const erreurs = []
    if (Object.keys(normalisees).length > 0 && Number(rarete) !== RARETE_CAPACITES) {
        erreurs.push("Seules les cartes légendaires peuvent avoir des capacités.")
    }
    for (const [id, valeur] of Object.entries(normalisees)) {
        if (!Object.hasOwn(CAPACITES, id)) {
            erreurs.push(`Capacité inconnue : ${id}.`)
        } else if (!CAPACITES[id] && valeur !== true) {
            erreurs.push(`La capacité ${id} n'a pas de niveau.`)
        } else if (CAPACITES[id] && (!Number.isInteger(valeur) || valeur < NIVEAU_MIN || valeur > NIVEAU_MAX)) {
            erreurs.push(`Le niveau de ${id} doit être un entier entre ${NIVEAU_MIN} et ${NIVEAU_MAX}.`)
        }
    }
    return erreurs
}
