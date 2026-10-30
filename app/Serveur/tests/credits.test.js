import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import {
    adminHeaders,
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

function modifier(corps, headers = adminHeaders()) {
    return request("/credits/modifier", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify(corps),
    })
}

test("GET /credits exige une authentification", async () => {
    const { response, body } = await request("/credits")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("GET /credits retourne le solde de l'utilisateur connecté", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ credits: 250 }], rowCount: 1 }
    })

    const { response, body } = await request("/credits", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.deepEqual(body, { credits: 250 })
    assert.deepEqual(queryParams, [7])
})

test("GET /credits retourne 404 si l'utilisateur n'existe plus", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/credits", { headers: authenticatedHeaders() })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Utilisateur introuvable")
})

test("GET /credits retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/credits", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("POST /credits/modifier exige un token", async () => {
    const { response, body } = await request("/credits/modifier", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ id_utilisateur: 7, montant: 50 }),
    })

    assert.equal(response.status, 401)
    assert.equal(body.message, "Accès refusé. Token manquant.")
})

test("POST /credits/modifier refuse un joueur qui n'est pas admin", async () => {
    const { response, body } = await modifier({ id_utilisateur: 7, montant: 50 }, authenticatedHeaders())

    assert.equal(response.status, 403)
    assert.equal(body.message, "Accès refusé")
})

for (const idInvalide of ["abc", 0, -1, 1.5]) {
    test(`POST /credits/modifier refuse id_utilisateur = ${idInvalide}`, async () => {
        const { response, body } = await modifier({ id_utilisateur: idInvalide, montant: 50 })

        assert.equal(response.status, 400)
        assert.ok(body.errors.some((error) => error.path === "id_utilisateur"))
    })
}

test("POST /credits/modifier refuse un id_utilisateur absent", async () => {
    const { response, body } = await modifier({ montant: 50 })

    assert.equal(response.status, 400)
    assert.ok(body.errors.some((error) => error.path === "id_utilisateur"))
})

for (const montantInvalide of [0, "abc", null]) {
    test(`POST /credits/modifier refuse un montant = ${montantInvalide}`, async () => {
        const { response, body } = await modifier({ id_utilisateur: 7, montant: montantInvalide })

        assert.equal(response.status, 400)
        assert.ok(body.errors.some((error) => error.path === "montant"))
    })
}

test("POST /credits/modifier ajoute des crédits", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ id: 7, credits: 150 }], rowCount: 1 }
    })

    const { response, body } = await modifier({ id_utilisateur: 7, montant: 50 })

    assert.equal(response.status, 200)
    assert.deepEqual(body, { id: 7, credits: 150 })
    assert.deepEqual(queryParams, [50, 7])
})

test("POST /credits/modifier retire des crédits avec un montant négatif", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ id: 7, credits: 70 }], rowCount: 1 }
    })

    const { response, body } = await modifier({ id_utilisateur: 7, montant: -30 })

    assert.equal(response.status, 200)
    assert.equal(body.credits, 70)
    assert.deepEqual(queryParams, [-30, 7])
})

test("POST /credits/modifier refuse un retrait qui rendrait le solde négatif", async () => {
    setQueryResult((sql) => {
        // la mise à jour conditionnelle ne touche aucune ligne, mais l'utilisateur existe
        if (sql.includes("select 1")) return { rows: [{ "?column?": 1 }], rowCount: 1 }
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await modifier({ id_utilisateur: 7, montant: -9999 })

    assert.equal(response.status, 400)
    assert.equal(body.error, "Crédits insuffisants")
})

test("POST /credits/modifier retourne 404 si l'utilisateur n'existe pas", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await modifier({ id_utilisateur: 999, montant: 50 })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Utilisateur introuvable")
})

test("POST /credits/modifier retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await modifier({ id_utilisateur: 7, montant: 50 })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})