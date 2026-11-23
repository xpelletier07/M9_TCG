import assert from "node:assert/strict"
import { test } from "node:test"
import {
    CAPACITES,
    CAPACITES_CIBLEES,
    NIVEAU_MAX,
    NIVEAU_MIN,
    aCapacite,
    niveauCapacite,
    normaliserCapacites,
    validerCapacites,
} from "../game/capacites.js"

test("normaliserCapacites tolère null et formes invalides", () => {
    for (const input of [null, undefined, "x", [], 42]) {
        assert.deepEqual(normaliserCapacites(input), {})
    }
    assert.deepEqual(normaliserCapacites({ vol: true, pioche: "3", haste: false, toxique: null }), { vol: true, pioche: 3 })
})

test("validerCapacites accepte les capacités de Combat.md avec leur niveau", () => {
    const capacites = { haste: true, provocation: true, vol: true, bouclier: 2, inspiration: 5, pioche: 1 }
    assert.deepEqual(validerCapacites(capacites, 4), [])
})

test("validerCapacites refuse les capacités hors catalogue ou mal graduées", () => {
    const cas = [
        [{ furie_des_vents: true }, 4],
        [{ effets: [] }, 4],
        [{ vol: 2 }, 4],
        [{ inspiration: true }, 4],
        [{ inspiration: 0 }, 4],
        [{ inspiration: 6 }, 4],
        [{ pioche: 2.5 }, 4],
        [{ vol: true }, 3],
    ]
    for (const [capacites, rarete] of cas) {
        const erreurs = validerCapacites(capacites, rarete)
        assert.ok(erreurs.length > 0, `devrait refuser ${JSON.stringify(capacites)} (rareté ${rarete})`)
    }
})

test("validerCapacites accepte des capacités vides sur toute rareté", () => {
    assert.deepEqual(validerCapacites({}, 1), [])
})

test("niveauCapacite et aCapacite tolèrent une carte sans capacités", () => {
    assert.equal(niveauCapacite({}, "vol"), 0)
    assert.equal(aCapacite({ capacites: null }, "vol"), false)
    assert.equal(niveauCapacite({ capacites: { vol: true } }, "vol"), 1)
    assert.equal(niveauCapacite({ capacites: { inspiration: 3 } }, "inspiration"), 3)
})

// ---------- Miroir client (app/Client/src/capacites.js) ----------

test("catalogues client et serveur identiques", async () => {
    const client = await import("../../Client/src/capacites.js")
    assert.deepEqual(Object.keys(client.CAPACITES_INFO), Object.keys(CAPACITES))
    for (const [id, gradue] of Object.entries(CAPACITES)) assert.equal(client.CAPACITES_INFO[id].gradue, gradue, id)
    assert.deepEqual(client.CAPACITES_CIBLEES, CAPACITES_CIBLEES)
    assert.equal(client.NIVEAU_MIN, NIVEAU_MIN)
    assert.equal(client.NIVEAU_MAX, NIVEAU_MAX)
})

test("lireCapacites client suit l'ordre du catalogue et ignore l'inconnu", async () => {
    const { lireCapacites, libelleCapacite, extraireCapacites } = await import("../../Client/src/capacites.js")
    const carte = { capacites: { pioche: 2, vol: true, inconnue: 1 } }
    const capacites = lireCapacites(carte)
    assert.deepEqual(capacites.map(libelleCapacite), ["Vol", "Pioche 2"])
    assert.equal(capacites[1].texte, "En jeu : pioche 2 cartes.")
    assert.deepEqual(extraireCapacites(carte), { vol: true, pioche: 2 })
    assert.deepEqual(lireCapacites({ capacites: null }), [])
})

test("etapesCiblage client ne demande une cible que si une créature peut être visée", async () => {
    const { etapesCiblage } = await import("../../Client/src/capacites.js")
    const carte = { capacites: { inspiration: 1, intimidation: 2 } }
    assert.deepEqual(etapesCiblage(carte, [{}], [{}]), ["inspiration", "intimidation"])
    assert.deepEqual(etapesCiblage(carte, [], [{}]), ["intimidation"])
    assert.deepEqual(etapesCiblage({ capacites: { vol: true } }, [{}], [{}]), [])
})
