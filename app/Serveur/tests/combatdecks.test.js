import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import {
    authenticatedHeaders,
    request,
    setQueryError,
    setQueryResult,
    startTestServer,
    stopTestServer,
    withSilentErrors,
} from "./app.test.js"
import { isDeckValid, loadDeckCards, pickDeckImage } from "../game/deckService.js"

before(startTestServer)
after(stopTestServer)

beforeEach(() => {
    setQueryResult({ rows: [], rowCount: 0 })
})

// Ligne SQL d'une carte dans un deck, telle que renvoyée par la requête du service
function row(overrides = {}) {
    return {
        id_deck: 1,
        nom_deck: "Deck Test",
        id_carte: 1,
        nom_carte: "Lutin",
        image: "lutin.png",
        description: "Petit",
        rarete: 1,
        mana: 1,
        health: 2,
        damage: 1,
        quantite_deck: 50,
        quantite_dispo: 50,
        ...overrides,
    }
}

test("isDeckValid true for 50 owned cards", () => {
    assert.equal(isDeckValid([row({ quantite_deck: 30 }), row({ id_carte: 2, quantite_deck: 20 })]), true)
})

test("isDeckValid false for 49", () => {
    assert.equal(isDeckValid([row({ quantite_deck: 49 })]), false)
})

test("isDeckValid false for 51", () => {
    assert.equal(isDeckValid([row({ quantite_deck: 51, quantite_dispo: 60 })]), false)
})

test("isDeckValid false when quantite_deck > quantite_dispo", () => {
    assert.equal(isDeckValid([row({ quantite_deck: 40 }), row({ id_carte: 2, quantite_deck: 10, quantite_dispo: 9 })]), false)
})

test("pickDeckImage picks highest mana then rarity then lowest id", () => {
    const cards = [
        { id_carte: 5, nom_carte: "A", image: "a", mana: 3, rarete: 4 },
        { id_carte: 4, nom_carte: "B", image: "b", mana: 7, rarete: 2 },
        { id_carte: 3, nom_carte: "C", image: "c", mana: 7, rarete: 3 },
        { id_carte: 2, nom_carte: "D", image: "d", mana: 7, rarete: 3 },
    ]
    assert.deepEqual(pickDeckImage(cards), { image: "d", nom_carte: "D" })
    assert.equal(pickDeckImage([]), null)
})

test("loadDeckCards returns null when quantity insufficient", async () => {
    setQueryResult({ rows: [row({ quantite_deck: 50, quantite_dispo: 10 })], rowCount: 1 })
    assert.equal(await loadDeckCards(7, 1), null)
})

test("loadDeckCards returns null when deck not found", async () => {
    setQueryResult({ rows: [], rowCount: 0 })
    assert.equal(await loadDeckCards(7, 99), null)
})

test("loadDeckCards expands quantities into 50 unique instanceIds", async () => {
    let params
    setQueryResult(async (sql, p) => {
        params = p
        return { rows: [row({ quantite_deck: 30 }), row({ id_carte: 2, nom_carte: "Golem", quantite_deck: 20 })], rowCount: 2 }
    })
    const cards = await loadDeckCards(7, 1)
    assert.deepEqual(params, [7, 1])
    assert.equal(cards.length, 50)
    assert.equal(new Set(cards.map((c) => c.instanceId)).size, 50)
    assert.equal(cards.filter((c) => c.id_carte === 2).length, 20)
    assert.ok(cards[0].instanceId.startsWith("7-1-"))
    assert.deepEqual(Object.keys(cards[0]).sort(), [
        "capacites", "damage", "description", "health", "id_carte", "image", "instanceId", "mana", "nom_carte", "rarete",
    ])
    // Une carte sans capacités en base reçoit un objet vide
    assert.deepEqual(cards[0].capacites, {})
})

test("GET /combat/decks requires auth", async () => {
    const { response } = await request("/combat/decks")
    assert.equal(response.status, 401)
})

test("GET /combat/decks returns only valid decks with image", async () => {
    setQueryResult({
        rows: [
            row({ id_deck: 1, nom_deck: "Valide", quantite_deck: 40 }),
            row({ id_deck: 1, nom_deck: "Valide", id_carte: 2, nom_carte: "Dragon", image: "dragon.png", mana: 8, quantite_deck: 10 }),
            row({ id_deck: 2, nom_deck: "Incomplet", quantite_deck: 49 }),
        ],
        rowCount: 3,
    })
    const { response, body } = await request("/combat/decks", { headers: authenticatedHeaders() })
    assert.equal(response.status, 200)
    assert.deepEqual(body, [
        { id_deck: 1, nom_deck: "Valide", total_cartes: 50, image: "dragon.png", nom_carte_image: "Dragon" },
    ])
})

test("GET /combat/decks returns 500 on sql error", async () => {
    setQueryError()
    await withSilentErrors(async () => {
        const { response, body } = await request("/combat/decks", { headers: authenticatedHeaders() })
        assert.equal(response.status, 500)
        assert.deepEqual(body, { error: "Erreur serveur" })
    })
})
