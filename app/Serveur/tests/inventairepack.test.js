import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import { globalClaimState, resetGlobalDropStateForTesting } from "../services/dropCommunService.js"
import {
    authenticatedHeaders,
    request,
    setQueryError,
    setQueryResult,
    startTestServer,
    stopTestServer,
    withSilentErrors,
} from "./app.test.js"

// Routes de /inventaire-pack : drop global, heartbeat, cooldown de 24h, ouverture et inventaire des packs

const packAlpha = {
    id_pack: 1,
    nom_pack: "Pack Alpha",
    image_pack: "alpha.png",
    description_pack: "Description",
    liste_carte: [1, 2, 3],
}
const cartes = [1, 2, 3, 4].map((id) => ({ id_carte: id, nom_carte: `Carte ${id}`, rarete: 1 }))

// Répond aux requêtes SQL du drop global (pack aléatoire du cycle + cartes du round)
function mockDrop() {
    setQueryResult((sql) => {
        if (sql.includes("from Packs")) return { rows: [packAlpha], rowCount: 1 }
        if (sql.includes("from carte")) return { rows: cartes, rowCount: cartes.length }
        return { rows: [], rowCount: 0 }
    })
}

before(startTestServer)
after(stopTestServer)

beforeEach(() => {
    resetGlobalDropStateForTesting()
    setQueryResult({ rows: [], rowCount: 0 })
})

// ATTENTION : ce test doit rester le premier. Le cycle du drop est mis en cache en mémoire
// après le premier chargement réussi, donc l'erreur ne peut être provoquée qu'avant.
test("GET /inventaire-pack/drop-state retourne 500 si le pack du cycle ne peut pas être chargé", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventaire-pack/drop-state")

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("GET /inventaire-pack/drop-state est public et retourne l'état du drop et le pack du cycle", async () => {
    mockDrop()

    const { response, body } = await request("/inventaire-pack/drop-state")

    assert.equal(response.status, 200)
    assert.equal(body.cycleSeconds, 300)
    assert.equal(body.isClaimReady, true)
    assert.equal(body.canClaim, true)
    assert.equal(body.claimedCount, 0)
    assert.equal(body.expectedClaimCount, 1)
    assert.equal(body.pack.id_pack, 1)
    assert.ok(!Number.isNaN(Date.parse(body.resetAt)))
})

test("GET /inventaire-pack/drop-state enregistre le joueur connecté comme actif", async () => {
    mockDrop()

    const { response } = await request("/inventaire-pack/drop-state", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.ok(globalClaimState.activeUsers.has("7"))
})

test("GET /inventaire-pack/drop-state ignore un token invalide (route publique)", async () => {
    mockDrop()

    const { response, body } = await request("/inventaire-pack/drop-state", {
        headers: { authorization: "Bearer pas-un-jwt" },
    })

    assert.equal(response.status, 200)
    assert.equal(body.canClaim, true)
    assert.equal(globalClaimState.activeUsers.size, 0)
})

test("GET /inventaire-pack/drop-state indique le cooldown global quand il est actif", async () => {
    mockDrop()
    globalClaimState.cooldownEndsAtMs = Date.now() + 120 * 1000

    const { response, body } = await request("/inventaire-pack/drop-state")

    assert.equal(response.status, 200)
    assert.equal(body.isClaimReady, false)
    assert.equal(body.canClaim, false)
    assert.ok(body.remainingSeconds > 0 && body.remainingSeconds <= 120)
    assert.equal(new Date(body.resetAt).getTime(), globalClaimState.cooldownEndsAtMs)
})

test("POST /inventaire-pack/heartbeat exige une authentification", async () => {
    const { response, body } = await request("/inventaire-pack/heartbeat", { method: "POST" })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("POST /inventaire-pack/heartbeat confirme la présence du joueur", async () => {
    mockDrop()

    const { response, body } = await request("/inventaire-pack/heartbeat", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(body, { ok: true })
})

test("GET /inventaire-pack/status refuse de réclamer pendant le cooldown de 24h", async () => {
    const il_y_a_une_heure = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    setQueryResult((sql) => {
        if (sql.includes("dernier_drop_pack_at")) {
            return { rows: [{ dernier_drop_pack_at: il_y_a_une_heure }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/inventaire-pack/status", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.canClaim, false)
    // il reste environ 23h
    assert.ok(body.cooldownRemainingSeconds > 22 * 3600 && body.cooldownRemainingSeconds <= 23 * 3600)
    assert.equal(new Date(body.cooldownResetAt).getTime(), Date.parse(il_y_a_une_heure) + 24 * 3600 * 1000)
    assert.deepEqual(body.inventory, [])
})

test("GET /inventaire-pack/status permet de réclamer quand le cooldown est écoulé", async () => {
    const il_y_a_25h = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    setQueryResult((sql) => {
        if (sql.includes("dernier_drop_pack_at")) {
            return { rows: [{ dernier_drop_pack_at: il_y_a_25h }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/inventaire-pack/status", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.canClaim, true)
    assert.equal(body.cooldownRemainingSeconds, 0)
})

test("GET /inventaire-pack/status retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventaire-pack/status", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("POST /inventaire-pack/:idPack retourne 404 sans consommer le cooldown si le pack est introuvable", async () => {
    const requetes = []
    setQueryResult((sql) => {
        requetes.push(sql)
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/inventaire-pack/999", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Pack introuvable ou inactif")
    assert.ok(!requetes.some((sql) => sql.includes("update utilisateurs")))
})

test("POST /inventaire-pack/:idPack n'ajoute aucun pack pendant le cooldown", async () => {
    const requetes = []
    setQueryResult((sql) => {
        requetes.push(sql)
        if (sql.includes("where id_pack = $1")) return { rows: [packAlpha], rowCount: 1 }
        if (sql.includes("update utilisateurs")) return { rows: [], rowCount: 0 }
        if (sql.includes("dernier_drop_pack_at from utilisateurs")) {
            return { rows: [{ dernier_drop_pack_at: new Date().toISOString() }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/inventaire-pack/1", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 429)
    assert.match(body.error, /24h/)
    assert.ok(body.cooldownRemainingSeconds > 23 * 3600)
    assert.ok(!Number.isNaN(Date.parse(body.cooldownResetAt)))
    assert.ok(!requetes.some((sql) => sql.includes("insert into inventaire_packs")))
})

test("POST /inventaire-pack/:idPack retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventaire-pack/1", {
            method: "POST",
            headers: authenticatedHeaders(),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("POST /inventaire-pack/:idPack/open exige une authentification", async () => {
    const { response, body } = await request("/inventaire-pack/1/open", { method: "POST" })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

for (const idInvalide of ["abc", "0", "-3", "1.5"]) {
    test(`POST /inventaire-pack/${idInvalide}/open refuse un identifiant de pack invalide`, async () => {
        const { response, body } = await request(`/inventaire-pack/${idInvalide}/open`, {
            method: "POST",
            headers: authenticatedHeaders(),
        })

        assert.equal(response.status, 400)
        assert.equal(body.error, "Identifiant de pack invalide")
    })
}

test("POST /inventaire-pack/:idPack/open retourne 404 si le joueur ne possède pas le pack", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/inventaire-pack/1/open", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Ce pack n'est pas dans votre inventaire")
})

test("POST /inventaire-pack/:idPack/open garde l'entrée d'inventaire s'il reste des exemplaires", async () => {
    const requetes = []
    setQueryResult((sql, params) => {
        requetes.push({ sql, params })
        if (sql.includes("select quantite from inventaire_packs")) return { rows: [{ quantite: 3 }], rowCount: 1 }
        if (sql.includes("update inventaire_packs ip")) {
            return { rows: [{ ...packAlpha, quantite: 2 }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/inventaire-pack/1/open", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 200)
    assert.equal(body.quantite, 2)
    assert.deepEqual(body.pack.liste_carte, [1, 2, 3])
    assert.deepEqual(requetes[0].params, [7, 1])
    assert.ok(!requetes.some(({ sql }) => sql.includes("delete from inventaire_packs")))
})

test("POST /inventaire-pack/:idPack/open supprime l'entrée d'inventaire quand le dernier exemplaire est ouvert", async () => {
    const requetes = []
    setQueryResult((sql, params) => {
        requetes.push({ sql, params })
        if (sql.includes("select quantite from inventaire_packs")) return { rows: [{ quantite: 1 }], rowCount: 1 }
        if (sql.includes("update inventaire_packs ip")) {
            return { rows: [{ ...packAlpha, quantite: 0 }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/inventaire-pack/1/open", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 200)
    assert.equal(body.quantite, 0)
    const suppression = requetes.find(({ sql }) => sql.includes("delete from inventaire_packs"))
    assert.ok(suppression)
    assert.deepEqual(suppression.params, [7, 1])
})

test("POST /inventaire-pack/:idPack/open retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventaire-pack/1/open", {
            method: "POST",
            headers: authenticatedHeaders(),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("GET /inventaire-pack/me exige une authentification", async () => {
    const { response, body } = await request("/inventaire-pack/me")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("GET /inventaire-pack/me retourne les packs de l'utilisateur avec leur quantité", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ ...packAlpha, quantite: 2 }], rowCount: 1 }
    })

    const { response, body } = await request("/inventaire-pack/me", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body[0].nom_pack, "Pack Alpha")
    assert.equal(body[0].quantite, 2)
    assert.deepEqual(queryParams, [7])
})

test("GET /inventaire-pack/me retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventaire-pack/me", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})