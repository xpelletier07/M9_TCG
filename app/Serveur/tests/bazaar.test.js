import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import {
    authenticatedHeaders,
    jsonHeaders,
    request,
    setQueryError,
    setQueryResult,
    startTestServer,
    stopTestServer,
    withSilentErrors,
} from "./app.test.js"

before(startTestServer)
after(stopTestServer)

beforeEach(() => {
    setQueryResult({ rows: [], rowCount: 0 })
})

function acheter(corps, headers = authenticatedHeaders()) {
    return request("/bazaar/acheter", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify(corps),
    })
}

const offreType = { id_offre: 10, id_vendeur: 2, id_carte: 1, quantite: 1, prix_unitaire: 8 }

// Simule la base : `offre` est le résultat du select sur l'offre, `debit` celui du update des crédits de l'acheteur
function simulerBd({ offre = offreType, debit = [{ credits: 100 }] } = {}) {
    const appels = []
    setQueryResult((sql, params) => {
        const texte = sql.replace(/\s+/g, " ").trim()
        appels.push({ sql: texte, params })
        if (/from ventes where id_transaction/.test(texte)) return { rows: offre ? [offre] : [], rowCount: offre ? 1 : 0 }
        if (/set credits = credits - /.test(texte)) return { rows: debit, rowCount: debit.length }
        return { rows: [], rowCount: 0 }
    })
    return appels
}

test("GET /bazaar/offres exige une authentification", async () => {
    const { response } = await request("/bazaar/offres")
    assert.equal(response.status, 401)
})

test("GET /bazaar/offres retourne les offres des autres joueurs avec vendeur, quantité et prix", async () => {
    let params
    setQueryResult((sql, p) => {
        params = p
        return { rows: [{ id_offre: 10, id_carte: 1, vendeur: "alice", quantite: 2, prix_unitaire: 5 }], rowCount: 1 }
    })
    const { response, body } = await request("/bazaar/offres", { headers: authenticatedHeaders() })
    assert.equal(response.status, 200)
    assert.equal(body[0].vendeur, "alice")
    assert.equal(body[0].prix_unitaire, 5)
    assert.deepEqual(params, [7]) // exclut les offres du joueur connecté
})

test("GET /bazaar/offres retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()
        const { response } = await request("/bazaar/offres", { headers: authenticatedHeaders() })
        assert.equal(response.status, 500)
    })
})

test("POST /bazaar/acheter exige une authentification", async () => {
    const { response } = await acheter({ id_offre: 10 }, {})
    assert.equal(response.status, 401)
})

test("POST /bazaar/acheter refuse un id_offre ou une quantité invalide", async () => {
    assert.equal((await acheter({ id_offre: "abc" })).response.status, 400)
    assert.equal((await acheter({ id_offre: 10, quantite: 0 })).response.status, 400)
    assert.equal((await acheter({ id_offre: 10, quantite: 1.5 })).response.status, 400)
})

test("POST /bazaar/acheter retourne 404 si l'offre n'existe pas", async () => {
    const appels = simulerBd({ offre: null })
    const { response } = await acheter({ id_offre: 10 })
    assert.equal(response.status, 404)
    assert.ok(appels.some((a) => a.sql === "rollback"))
})

test("POST /bazaar/acheter refuse d'acheter sa propre offre", async () => {
    simulerBd({ offre: { ...offreType, id_vendeur: 7 } })
    const { response } = await acheter({ id_offre: 10 })
    assert.equal(response.status, 400)
})

test("POST /bazaar/acheter retourne 409 si la quantité dépasse celle de l'offre (un exemplaire)", async () => {
    simulerBd()
    const { response } = await acheter({ id_offre: 10, quantite: 2 })
    assert.equal(response.status, 409)
})

test("POST /bazaar/acheter retourne 400 si les crédits sont insuffisants", async () => {
    const appels = simulerBd({ debit: [] })
    const { response, body } = await acheter({ id_offre: 10 })
    assert.equal(response.status, 400)
    assert.equal(body.error, "Crédits insuffisants")
    assert.ok(appels.some((a) => a.sql === "rollback"))
    assert.ok(!appels.some((a) => a.sql.startsWith("insert into inventaire_carte")))
})

test("POST /bazaar/acheter transfère crédits et carte, et marque la vente comme complétée", async () => {
    const appels = simulerBd({ debit: [{ credits: 992 }] })
    const { response, body } = await acheter({ id_offre: 10 })

    assert.equal(response.status, 200)
    assert.equal(body.quantite, 1)
    assert.equal(body.total, 8)
    assert.equal(body.credits, 992)
    assert.equal(appels[0].sql, "begin")
    assert.equal(appels.at(-1).sql, "commit")
    assert.deepEqual(appels.find((a) => /set credits = credits - /.test(a.sql)).params, [8, 7])
    assert.deepEqual(appels.find((a) => /set credits = credits \+ /.test(a.sql)).params, [8, 2])
    assert.deepEqual(appels.find((a) => a.sql.startsWith("update ventes set id_acheteur")).params, [7, 10])
    assert.deepEqual(appels.find((a) => a.sql.startsWith("insert into inventaire_carte")).params, [7, 1, 1])
})

test("POST /bazaar/acheter retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()
        const { response } = await acheter({ id_offre: 10 })
        assert.equal(response.status, 500)
    })
})

test("GET /bazaar/cartes retourne toutes les cartes avec le prix le plus bas et exclut les offres du joueur", async () => {
    let params
    setQueryResult((sql, p) => {
        params = p
        return { rows: [{ id_carte: 1, nom_carte: "A", quantite_en_vente: 3, nb_vendeurs: 2, prix_min: 4 }, { id_carte: 2, nom_carte: "B", quantite_en_vente: 0, nb_vendeurs: 0, prix_min: null }], rowCount: 2 }
    })
    const { response, body } = await request("/bazaar/cartes", { headers: authenticatedHeaders() })
    assert.equal(response.status, 200)
    assert.equal(body.length, 2)
    assert.equal(body[0].prix_min, 4)
    assert.deepEqual(params, [7])
})

test("GET /bazaar/cartes exige une authentification", async () => {
    const { response } = await request("/bazaar/cartes")
    assert.equal(response.status, 401)
})

function acheterMoinsChers(corps, headers = authenticatedHeaders()) {
    return request("/bazaar/acheter-moins-chers", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify(corps),
    })
}

test("POST /bazaar/acheter-moins-chers refuse une quantité hors de 1 à 5", async () => {
    const { response } = await acheterMoinsChers({ id_carte: 1, quantite: 6 })
    assert.equal(response.status, 400)
})

test("POST /bazaar/acheter-moins-chers retourne 409 s'il n'y a pas assez d'exemplaires", async () => {
    setQueryResult((sql) => {
        if (/from ventes/.test(sql)) return { rows: [{ id_offre: 1, id_vendeur: 2, id_carte: 1, prix_unitaire: 3 }], rowCount: 1 }
        return { rows: [], rowCount: 0 }
    })
    const { response } = await acheterMoinsChers({ id_carte: 1, quantite: 2 })
    assert.equal(response.status, 409)
})

test("POST /bazaar/acheter-moins-chers prend les offres les moins chères et débite le total", async () => {
    const appels = []
    setQueryResult((sql, params) => {
        const texte = sql.replace(/\s+/g, " ").trim()
        appels.push({ sql: texte, params })
        if (/from ventes/.test(texte)) {
            return { rows: [
                { id_offre: 1, id_vendeur: 2, id_carte: 1, prix_unitaire: 3 },
                { id_offre: 2, id_vendeur: 3, id_carte: 1, prix_unitaire: 4 },
            ], rowCount: 2 }
        }
        if (/set credits = credits - /.test(texte)) return { rows: [{ credits: 50 }], rowCount: 1 }
        return { rows: [], rowCount: 0 }
    })
    const { response, body } = await acheterMoinsChers({ id_carte: 1, quantite: 2 })
    assert.equal(response.status, 200)
    assert.equal(body.total, 7) // 3 + 4
    assert.equal(body.nb_offres, 2)
    const ventes = appels.filter((a) => a.sql.startsWith("update ventes set id_acheteur"))
    assert.deepEqual(ventes.map((a) => a.params), [[7, 1], [7, 2]])
})
