import { pool } from "../db/pool.js"
import { RULES } from "./engine.js"

// Quantité d'une carte que le joueur peut mettre dans un deck.
// Les cartes en vente au Bazaar ne comptent pas : quand la table d'annonces existera,
// soustraire ici les exemplaires listés (sauf si la mise en vente retire déjà la carte de inventaire_carte).
export const AVAILABLE_QTY_SQL = "coalesce(ic.quantite, 0)"

// Une ligne par carte de chaque deck du joueur (ou d'un seul deck si deckId est fourni)
async function fetchDeckRows(userId, deckId = null) {
    const params = deckId === null ? [userId] : [userId, deckId]
    const { rows } = await pool.query(
        `select d.id_deck, d.nom_deck,
                c.id_carte, c.nom_carte, c.image, c.description, c.rarete, c.mana, c.health, c.damage,
                dc.quantite as quantite_deck,
                ${AVAILABLE_QTY_SQL} as quantite_dispo
         from deck d
         join deck_carte dc on dc.id_deck = d.id_deck
         join carte c on c.id_carte = dc.id_carte
         left join inventaire_carte ic on ic.id_carte = c.id_carte and ic.id_utilisateur = d.id_utilisateur
         where d.id_utilisateur = $1 ${deckId === null ? "" : "and d.id_deck = $2"}
         order by d.id_deck, c.id_carte`,
        params
    )
    return rows
}

export function isDeckValid(rows) {
    const total = rows.reduce((sum, r) => sum + Number(r.quantite_deck), 0)
    return total === RULES.DECK_SIZE && rows.every((r) => Number(r.quantite_deck) <= Number(r.quantite_dispo))
}

// Image du deck : la carte la plus chère en mana, puis la plus rare, puis le plus petit id
export function pickDeckImage(cards) {
    if (cards.length === 0) return null
    const [best] = [...cards].sort((a, b) => b.mana - a.mana || b.rarete - a.rarete || a.id_carte - b.id_carte)
    return { image: best.image, nom_carte: best.nom_carte }
}

function summarize(rows) {
    const cover = pickDeckImage(rows)
    return {
        id_deck: rows[0].id_deck,
        nom_deck: rows[0].nom_deck,
        total_cartes: RULES.DECK_SIZE,
        image: cover.image,
        nom_carte_image: cover.nom_carte,
    }
}

export async function listValidDecks(userId) {
    const rows = await fetchDeckRows(userId)
    const byDeck = new Map()
    for (const r of rows) {
        if (!byDeck.has(r.id_deck)) byDeck.set(r.id_deck, [])
        byDeck.get(r.id_deck).push(r)
    }
    return [...byDeck.values()].filter(isDeckValid).map(summarize)
}

// Résumé d'un seul deck valide (null s'il est invalide ou n'appartient pas au joueur)
export async function getValidDeckSummary(userId, deckId) {
    const rows = await fetchDeckRows(userId, deckId)
    return rows.length > 0 && isDeckValid(rows) ? summarize(rows) : null
}

// Les 50 cartes du deck prêtes pour le moteur, ou null si le deck est invalide
export async function loadDeckCards(userId, deckId) {
    const rows = await fetchDeckRows(userId, deckId)
    if (rows.length === 0 || !isDeckValid(rows)) return null
    const cards = []
    let counter = 0
    for (const r of rows) {
        for (let i = 0; i < Number(r.quantite_deck); i++) {
            cards.push({
                instanceId: `${userId}-${r.id_carte}-${counter++}`,
                id_carte: r.id_carte,
                nom_carte: r.nom_carte,
                image: r.image,
                description: r.description,
                rarete: r.rarete,
                mana: r.mana,
                health: r.health,
                damage: r.damage,
            })
        }
    }
    return cards
}
