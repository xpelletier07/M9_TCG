import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import { globalClaimState, resetGlobalDropStateForTesting } from "../services/dropCommunService.js"
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

// Routes de /cards : cartes aléatoires, drop commun (claim) et ouverture d'un pack

const cartes = Array.from({ length: 12 }, (_, i) => ({
    id_carte: i + 1,
    nom_carte: `Carte ${i + 1}`,
    rarete: (i % 4) + 1,
}))

// Répond aux requêtes SQL de la table carte, et permet de personnaliser le reste
function mockCartes({ carteExiste = true, onInsert } = {}) {
    setQueryResult((sql, params) => {
        if (sql.includes("select * from carte")) return { rows: cartes, rowCount: cartes.length }
        if (sql.includes("select id_carte from carte where id_carte")) {
            return carteExiste ? { rows: [{ id_carte: params[0] }], rowCount: 1 } : { rows: [], rowCount: 0 }
        }
        if (sql.includes("insert into inventaire_carte")) {
            onInsert?.(params)
            return { rows: [], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
    })
}

// Simule des joueurs déjà connectés au drop commun (le nombre de claims attendus augmente)
function connecterAutresJoueurs(...ids) {
    for (const id of ids) {
        globalClaimState.activeUsers.set(String(id), Date.now())
    }
}

function claim(idCarte, headers = authenticatedHeaders()) {
    return request("/cards/claim", {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify({ id_carte: idCarte }),
    })
}

before(startTestServer)
after(stopTestServer)

beforeEach(() => {
    resetGlobalDropStateForTesting()
    setQueryResult({ rows: [], rowCount: 0 })
})

// -------------------------------------------------------------
// GET /cards/random
// -------------------------------------------------------------

test("GET /cards/random exige une authentification", async () => {
    const { response, body } = await request("/cards/random")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("GET /cards/random retourne 3 cartes distinctes par défaut", async () => {
    mockCartes()

    const { response, body } = await request("/cards/random", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.length, 3)
    assert.equal(new Set(body.map((carte) => carte.id_carte)).size, 3)
})

test("GET /cards/random respecte le paramètre count", async () => {
    mockCartes()

    const { response, body } = await request("/cards/random?count=5", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.length, 5)
})

test("GET /cards/random limite count à 10", async () => {
    mockCartes()

    const { response, body } = await request("/cards/random?count=50", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.length, 10)
})

for (const countInvalide of ["0", "-2", "abc"]) {
    test(`GET /cards/random utilise 3 cartes si count = ${countInvalide}`, async () => {
        mockCartes()

        const { response, body } = await request(`/cards/random?count=${countInvalide}`, {
            headers: authenticatedHeaders(),
        })

        assert.equal(response.status, 200)
        assert.equal(body.length, 3)
    })
}

test("GET /cards/random retourne 404 s'il n'existe aucune carte", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/cards/random", { headers: authenticatedHeaders() })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Aucune carte disponible")
})

test("GET /cards/random retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/cards/random", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

// -------------------------------------------------------------
// GET /cards/claim/status
// -------------------------------------------------------------

test("GET /cards/claim/status exige une authentification", async () => {
    const { response, body } = await request("/cards/claim/status")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("GET /cards/claim/status indique que le joueur peut réclamer quand le drop est actif", async () => {
    mockCartes()

    const { response, body } = await request("/cards/claim/status", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.canClaim, true)
    assert.equal(body.hasClaimedCurrentRound, false)
    assert.equal(body.connectedUsers, 1)
    assert.deepEqual(body.claimedCardIds, [])
    assert.equal(body.claimedCount, 0)
    assert.equal(body.expectedClaimCount, 1)
    assert.equal(body.cooldownRemainingSeconds, 0)
    assert.equal(body.cooldownResetAt, null)
})

test("GET /cards/claim/status indique le cooldown global pendant la pause de 5 minutes", async () => {
    mockCartes()
    globalClaimState.cooldownEndsAtMs = Date.now() + 200 * 1000

    const { response, body } = await request("/cards/claim/status", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.canClaim, false)
    assert.ok(body.cooldownRemainingSeconds > 0 && body.cooldownRemainingSeconds <= 200)
    assert.equal(new Date(body.cooldownResetAt).getTime(), globalClaimState.cooldownEndsAtMs)
})

test("GET /cards/claim/status compte les joueurs connectés et les cartes déjà réclamées", async () => {
    mockCartes()
    connecterAutresJoueurs(8, 9)
    globalClaimState.roundClaimedCardIds.add(4)
    globalClaimState.roundClaimedUserIds.add("8")

    const { response, body } = await request("/cards/claim/status", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.connectedUsers, 3)
    assert.deepEqual(body.claimedCardIds, [4])
    assert.equal(body.claimedCount, 1)
    assert.equal(body.expectedClaimCount, 3)
    assert.equal(body.canClaim, true)
})

test("GET /cards/claim/status indique si le joueur a déjà réclamé pour ce round", async () => {
    mockCartes()
    connecterAutresJoueurs(8, 9)
    globalClaimState.roundClaimedCardIds.add(4)
    globalClaimState.roundClaimedUserIds.add("7")

    const { response, body } = await request("/cards/claim/status", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.hasClaimedCurrentRound, true)
    assert.equal(body.canClaim, false)
})

// -------------------------------------------------------------
// GET /cards/claim/options
// -------------------------------------------------------------

test("GET /cards/claim/options exige une authentification", async () => {
    const { response, body } = await request("/cards/claim/options")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("GET /cards/claim/options retourne les 3 cartes du round, identiques pour tous les joueurs", async () => {
    mockCartes()

    const premier = await request("/cards/claim/options", { headers: authenticatedHeaders() })
    const second = await request("/cards/claim/options", { headers: authenticatedHeaders({ id: 8 }) })

    assert.equal(premier.response.status, 200)
    assert.equal(premier.body.cards.length, 3)
    assert.deepEqual(premier.body.claimedCardIds, [])
    assert.deepEqual(second.body.cards, premier.body.cards)
})

test("GET /cards/claim/options masque les cartes pendant le cooldown global", async () => {
    mockCartes()
    globalClaimState.cooldownEndsAtMs = Date.now() + 60 * 1000
    globalClaimState.roundClaimedCardIds.add(2)

    const { response, body } = await request("/cards/claim/options", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.deepEqual(body, { cards: [], claimedCardIds: [2] })
})

test("GET /cards/claim/options retourne 404 s'il n'existe aucune carte", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/cards/claim/options", { headers: authenticatedHeaders() })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Aucune carte disponible")
})

// -------------------------------------------------------------
// POST /cards/claim
// -------------------------------------------------------------

test("POST /cards/claim exige une authentification", async () => {
    const { response, body } = await request("/cards/claim", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ id_carte: 1 }),
    })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

for (const idInvalide of [undefined, null, 0, -4, "abc"]) {
    test(`POST /cards/claim refuse id_carte = ${idInvalide}`, async () => {
        mockCartes()

        const { response, body } = await claim(idInvalide)

        assert.equal(response.status, 400)
        assert.equal(body.error, "id_carte invalide")
    })
}

test("POST /cards/claim ajoute la carte à l'inventaire du joueur", async () => {
    let insertParams
    mockCartes({ onInsert: (params) => (insertParams = params) })
    connecterAutresJoueurs(8, 9)

    const { response, body } = await claim(5)

    assert.equal(response.status, 201)
    assert.equal(body.message, "Carte réclamée avec succès")
    assert.equal(body.id_carte, 5)
    assert.equal(body.canClaim, false)
    assert.equal(body.hasClaimedCurrentRound, true)
    assert.deepEqual(body.claimedCardIds, [5])
    assert.equal(body.claimedCount, 1)
    assert.deepEqual(insertParams, [7, 5])
})

test("POST /cards/claim démarre le cooldown de 5 minutes quand tous les joueurs ont réclamé", async () => {
    mockCartes()

    const { response, body } = await claim(5)

    assert.equal(response.status, 201)
    assert.equal(body.cooldownRemainingSeconds, 300)
    assert.ok(!Number.isNaN(Date.parse(body.cooldownResetAt)))
    assert.ok(globalClaimState.cooldownEndsAtMs > Date.now())
})

test("POST /cards/claim retourne 429 pendant le cooldown global", async () => {
    mockCartes()
    globalClaimState.cooldownEndsAtMs = Date.now() + 120 * 1000

    const { response, body } = await claim(5)

    assert.equal(response.status, 429)
    assert.equal(body.error, "Cooldown global actif pour le claim de carte")
    assert.equal(body.canClaim, false)
    assert.ok(body.cooldownRemainingSeconds > 0)
})

test("POST /cards/claim refuse qu'un joueur réclame deux cartes dans le même round", async () => {
    let insertions = 0
    mockCartes({ onInsert: () => insertions++ })
    connecterAutresJoueurs(8, 9)

    const premiere = await claim(5)
    const seconde = await claim(6)

    assert.equal(premiere.response.status, 201)
    assert.equal(seconde.response.status, 400)
    assert.equal(seconde.body.error, "Vous avez déjà réclamé une carte pour ce round")
    assert.equal(seconde.body.hasClaimedCurrentRound, true)
    assert.equal(insertions, 1)
})

test("POST /cards/claim retourne 404 si la carte n'existe pas", async () => {
    mockCartes({ carteExiste: false })

    const { response, body } = await claim(999)

    assert.equal(response.status, 404)
    assert.equal(body.error, "Carte introuvable")
})

test("POST /cards/claim retourne 409 si la carte a déjà été prise par un autre joueur", async () => {
    let insertions = 0
    mockCartes({ onInsert: () => insertions++ })
    connecterAutresJoueurs(8, 9)
    globalClaimState.roundClaimedCardIds.add(5)
    globalClaimState.roundClaimedUserIds.add("8")

    const { response, body } = await claim(5)

    assert.equal(response.status, 409)
    assert.equal(body.error, "Cette carte a deja ete claim par un autre joueur")
    assert.deepEqual(body.claimedCardIds, [5])
    assert.equal(insertions, 0)
})

test("POST /cards/claim retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryResult((sql) => {
            if (sql.includes("select * from carte")) return { rows: cartes, rowCount: cartes.length }
            throw new Error("Erreur de base de données simulée")
        })

        const { response, body } = await claim(5)

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

// -------------------------------------------------------------
// POST /cards/openPack/:id
// -------------------------------------------------------------

// Les cartes d'un pack viennent de UNNEST(liste_carte) ; les doublons sont permis
function mockCartesDuPack(ids) {
    return setQueryResult((sql, params) => {
        if (sql.toLowerCase().includes("unnest(liste_carte)")) {
            return { rows: ids.map((id_carte) => ({ id_carte })), rowCount: ids.length }
        }
        return { rows: [], rowCount: 0 }
    })
}

test("POST /cards/openPack/:id exige une authentification", async () => {
    const { response, body } = await request("/cards/openPack/1", { method: "POST" })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("POST /cards/openPack/:id retourne 3 cartes tirées de la liste du pack", async () => {
    mockCartesDuPack([10, 11, 12, 13])

    const { response, body } = await request("/cards/openPack/1", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 200)
    assert.equal(body.length, 3)
    assert.ok(body.every(({ id_carte }) => [10, 11, 12, 13].includes(id_carte)))
})

test("POST /cards/openPack/:id permet des doublons quand le pack contient peu de cartes", async () => {
    mockCartesDuPack([10])

    const { response, body } = await request("/cards/openPack/1", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(body.map(({ id_carte }) => id_carte), [10, 10, 10])
})

test("POST /cards/openPack/:id respecte count et le limite à 10", async () => {
    mockCartesDuPack([10, 11])

    const cinq = await request("/cards/openPack/1?count=5", { method: "POST", headers: authenticatedHeaders() })
    const cinquante = await request("/cards/openPack/1?count=50", { method: "POST", headers: authenticatedHeaders() })

    assert.equal(cinq.body.length, 5)
    assert.equal(cinquante.body.length, 10)
})

test("POST /cards/openPack/:id interroge le pack demandé", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ id_carte: 10 }], rowCount: 1 }
    })

    await request("/cards/openPack/42", { method: "POST", headers: authenticatedHeaders() })

    assert.deepEqual(queryParams, [42])
})

test("POST /cards/openPack/:id retourne 404 si le pack est vide ou inexistant", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/cards/openPack/999", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Aucune carte disponnible")
})

test("POST /cards/openPack/:id retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/cards/openPack/1", {
            method: "POST",
            headers: authenticatedHeaders(),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})