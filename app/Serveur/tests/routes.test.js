import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import {
    authenticatedHeaders,
    request,
    setQueryResult,
    startTestServer,
    stopTestServer,
} from "./app.test.js"

let clientToken
let adminToken

async function loginAs(email, password, account) {
    const passwordHash = await bcrypt.hash(password, 10)
    setQueryResult({
        rows: [{
            id: account.id,
            nom_utilisateur: account.nom_utilisateur,
            email,
            mot_de_passe_hash: passwordHash,
            statut: account.statut,
        }],
        rowCount: 1,
        ok: true,
    })

    const { response, body } = await request("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
    })

    assert.equal(response.status, 200)
    assert.ok(body.token)
    return body.token
}

before(async () => {
    await startTestServer()
    clientToken = await loginAs("client@example.com", "client-password", {
        id: 2,
        nom_utilisateur: "client",
        statut: "actif",
    })
    adminToken = await loginAs("admin@example.com", "admin-password", {
        id: 1,
        nom_utilisateur: "admin",
        statut: "admin",
    })
})
after(stopTestServer)

test("GET / retourne le message de l'API", async () => {
    const { response, body } = await request("/")

    assert.equal(response.status, 200)
    assert.deepEqual(body, { message: "M9 TCG API en ligne" })
})

test("GET /health confirme que l'API est disponible", async () => {
    const { response, body } = await request("/health")

    assert.equal(response.status, 200)
    assert.deepEqual(body, { status: "ok" })
})

test("POST /auth/signup refuse les champs manquants", async () => {
    const { response, body } = await request("/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "joueur@example.com" }),
    })

    assert.equal(response.status, 400)
    assert.equal(body.error, "Nom d'utilisateur, email et mot de passe requis")
})

test("POST /auth/signup valide le format de l'email", async () => {
    const { response, body } = await request("/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            nom_utilisateur: "joueur",
            email: "email-invalide",
            password: "motdepasse",
        }),
    })

    assert.equal(response.status, 400)
    assert.equal(body.error, "Format d'email invalide")
})

test("POST /auth/login refuse les identifiants incomplets", async () => {
    const { response, body } = await request("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "joueur@example.com" }),
    })

    assert.equal(response.status, 400)
    assert.equal(body.error, "Email et mot de passe requis")
})

test("POST /auth/login connecte un compte client", async () => {
    assert.equal(jwt.verify(clientToken, process.env.JWT_SECRET).statut, "actif")
})

test("POST /auth/login connecte un compte admin", async () => {
    assert.equal(jwt.verify(adminToken, process.env.JWT_SECRET).statut, "admin")
})

test("GET /inventory/cards exige une authentification", async () => {
    const { response, body } = await request("/inventory/cards")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("POST /collection/card valide les champs obligatoires", async () => {
    const { response, body } = await request("/collection/card", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({}),
    })

    assert.equal(response.status, 400)
    assert.ok(Array.isArray(body.erreurs))
    assert.ok(body.erreurs.some((error) => error.path === "nomCarte"))
})

test("POST /auth/check-email indique si l'email existe", async () => {
    setQueryResult({ rows: [{ id: 1 }], rowCount: 1, ok: true })

    const { response, body } = await request("/auth/check-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "joueur@example.com" }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(body, { exists: true })
})

test("POST /auth/signup refuse un utilisateur déjà existant", async () => {
    setQueryResult({ rows: [{ id: 1 }], rowCount: 1, ok: true })

    const { response, body } = await request("/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            nom_utilisateur: "joueur",
            email: "joueur@example.com",
            password: "motdepasse",
        }),
    })

    assert.equal(response.status, 409)
    assert.equal(body.error, "Email ou nom d'utilisateur déjà utilisé")
})

test("GET /collection/all retourne les cartes", async () => {
    setQueryResult({ rows: [{ id_carte: 1, nom_carte: "Carte test" }], rowCount: 1, ok: true })

    const { response, body } = await request("/collection/all", {
        headers: { authorization: `Bearer ${clientToken}` },
    })

    assert.equal(response.status, 200)
    assert.equal(body[0].nom_carte, "Carte test")
})

test("GET /collection/:id retourne une carte", async () => {
    setQueryResult({ rows: [{ id_carte: 3, nom_carte: "Carte test" }], rowCount: 1, ok: true })

    const { response, body } = await request("/collection/3", {
        headers: { authorization: `Bearer ${clientToken}` },
    })

    assert.equal(response.status, 200)
    assert.equal(body.id_carte, 3)
})

test("POST /collection/card crée une carte valide", async () => {
    setQueryResult({ rows: [{ id_carte: 4, nom_carte: "Carte test" }], rowCount: 1, ok: true })

    const { response, body } = await request("/collection/card", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
            nomCarte: "Carte test",
            image: "image.png",
            description: "Une carte",
            rarete: "1",
            valeur: "10",
            mana: "2",
            health: "5",
            damage: "3",
        }),
    })

    assert.equal(response.status, 201)
    assert.equal(body.id_carte, 4)
})

test("GET /api/card/:id retourne une carte", async () => {
    setQueryResult({ rows: [{ id_carte: 5, nom_carte: "Carte test" }], rowCount: 1, ok: true })

    const { response, body } = await request("/api/card/5")

    assert.equal(response.status, 200)
    assert.equal(body.id_carte, 5)
})

test("GET /inventaire/:id_user retourne l'inventaire", async () => {
    setQueryResult({ rows: [{ id_utilisateur: 7, id_carte: 5 }], rowCount: 1, ok: true })

    const { response, body } = await request("/inventaire/7")

    assert.equal(response.status, 200)
    assert.deepEqual(body, { cartes: [{ id_utilisateur: 7, id_carte: 5 }] })
})

test("POST /carteInventaire/:id_user/:id_carte ajoute une carte", async () => {
    setQueryResult({ rows: [{ id_utilisateur: 7, id_carte: 5 }], rowCount: 1, ok: true })

    const { response, body } = await request("/carteInventaire/7/5", { method: "POST" })

    assert.equal(response.status, 201)
    assert.equal(body.newCard.id_carte, 5)
})

test("DELETE /carteInventaire/:id_user/:id_carte supprime une carte", async () => {
    setQueryResult({ rows: [{ id_utilisateur: 7, id_carte: 5 }], rowCount: 1, ok: true })

    const { response, body } = await request("/carteInventaire/7/5", { method: "DELETE" })

    assert.equal(response.status, 200)
    assert.equal(body.deletedCard.id_carte, 5)
})

test("GET /inventory/cards retourne les cartes de l'utilisateur", async () => {
    setQueryResult({ rows: [{ id_carte: 5, quantite: 2 }], rowCount: 1, ok: true })

    const { response, body } = await request("/inventory/cards", {
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(body, [{ id_carte: 5, quantite: 2 }])
})

test("GET /inventory/decks retourne les decks de l'utilisateur", async () => {
    setQueryResult({ rows: [{ id_deck: 2, nom_deck: "Premier deck" }], rowCount: 1, ok: true })

    const { response, body } = await request("/inventory/decks", {
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 200)
    assert.equal(body[0].id_deck, 2)
})

test("GET /inventory/decks/:id retourne 404 si le deck est introuvable", async () => {
    setQueryResult({ rows: [], rowCount: 0, ok: true })

    const { response, body } = await request("/inventory/decks/99", {
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Deck introuvable")
})

test("POST /inventory/decks refuse un nom vide", async () => {
    const { response, body } = await request("/inventory/decks", {
        method: "POST",
        headers: { ...authenticatedHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ nomDeck: "" }),
    })

    assert.equal(response.status, 400)
    assert.match(body.error, /nom du deck est requis/)
})

test("POST /inventory/decks crée un deck", async () => {
    setQueryResult({ rows: [{ id_deck: 3, nom_deck: "Nouveau deck" }], rowCount: 1, ok: true })

    const { response, body } = await request("/inventory/decks", {
        method: "POST",
        headers: { ...authenticatedHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ nomDeck: "Nouveau deck" }),
    })

    assert.equal(response.status, 201)
    assert.equal(body.id_deck, 3)
})

test("POST /inventory/decks/:id/cards/:idCarte refuse une quantité invalide", async () => {
    const { response, body } = await request("/inventory/decks/3/cards/5", {
        method: "POST",
        headers: { ...authenticatedHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ quantite: 0 }),
    })

    assert.equal(response.status, 400)
    assert.equal(body.error, "La quantité doit être supérieure à zéro")
})

test("DELETE /inventory/decks/:id/cards/:idCarte retourne 404 si la carte est absente", async () => {
    setQueryResult({ rows: [], rowCount: 0, ok: true })

    const { response, body } = await request("/inventory/decks/3/cards/5", {
        method: "DELETE",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Carte absente du deck ou deck introuvable")
})

test("PATCH /inventory/decks/:id refuse un nom vide", async () => {
    const { response, body } = await request("/inventory/decks/3", {
        method: "PATCH",
        headers: { ...authenticatedHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ nomDeck: "" }),
    })

    assert.equal(response.status, 400)
    assert.match(body.error, /nom du deck est requis/)
})

test("PATCH /inventory/decks/:id modifie un deck", async () => {
    setQueryResult({ rows: [{ id_deck: 3, nom_deck: "Deck modifié" }], rowCount: 1, ok: true })

    const { response, body } = await request("/inventory/decks/3", {
        method: "PATCH",
        headers: { ...authenticatedHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ nomDeck: "Deck modifié" }),
    })

    assert.equal(response.status, 200)
    assert.equal(body.nom_deck, "Deck modifié")
})

test("DELETE /inventory/decks/:id retourne 404 si le deck est introuvable", async () => {
    setQueryResult({ rows: [], rowCount: 0, ok: true })

    const { response, body } = await request("/inventory/decks/99", {
        method: "DELETE",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Deck introuvable")
})

test("GET /inventaire-pack/drop-state retourne un cycle de 5 minutes", async () => {
    setQueryResult({ rows: [{ id_pack: 1, nom_pack: "Pack Commun", image_pack: "img.png" }], rowCount: 1, ok: true })

    const { response, body } = await request("/inventaire-pack/drop-state")

    assert.equal(response.status, 200)
    assert.equal(body.cycleSeconds, 300)
    assert.ok(typeof body.remainingSeconds === "number")
    assert.ok(body.remainingSeconds <= 300)
    assert.equal(body.cooldownRemainingSeconds, undefined)
})

test("GET /inventaire-pack/status exige une authentification", async () => {
    const { response, body } = await request("/inventaire-pack/status")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("GET /inventaire-pack/status indique si l'utilisateur peut réclamer", async () => {
    setQueryResult((sql) => {
        if (sql.includes("dernier_drop_pack_at")) {
            return { rows: [{ dernier_drop_pack_at: null }], rowCount: 1, ok: true }
        }
        return { rows: [{ id_pack: 1, quantite: 2 }], rowCount: 1, ok: true }
    })

    const { response, body } = await request("/inventaire-pack/status", {
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 200)
    assert.equal(body.canClaim, true)
    assert.equal(body.cooldownRemainingSeconds, 0)
    assert.deepEqual(body.inventory, [{ id_pack: 1, quantite: 2 }])
})

test("POST /inventaire-pack/open exige une authentification", async () => {
    const { response, body } = await request("/inventaire-pack/open", {
        method: "POST",
    })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("POST /inventaire-pack/open refuse si le cooldown de 24h est actif", async () => {
    setQueryResult((sql) => {
        if (sql.includes("where id_pack = $1")) {
            return { rows: [{ id_pack: 1, nom_pack: "Pack Alpha", actif: true }], rowCount: 1, ok: true }
        }
        if (sql.includes("update utilisateurs")) {
            return { rows: [], rowCount: 0, ok: true }
        }
        if (sql.includes("dernier_drop_pack_at from utilisateurs")) {
            return { rows: [{ dernier_drop_pack_at: new Date().toISOString() }], rowCount: 1, ok: true }
        }
        return { rows: [], rowCount: 0, ok: true }
    })

    const { response, body } = await request("/inventaire-pack/open", {
        method: "POST",
        headers: { ...authenticatedHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ id_pack: 1 }),
    })

    assert.equal(response.status, 429)
    assert.match(body.error, /24h/)
    assert.ok(body.cooldownRemainingSeconds > 0)
})

test("POST /inventaire-pack/open réclame le pack si éligible", async () => {
    setQueryResult((sql) => {
        if (sql.includes("where id_pack = $1")) {
            return { rows: [{ id_pack: 1, nom_pack: "Pack Alpha", actif: true }], rowCount: 1, ok: true }
        }
        if (sql.includes("update utilisateurs")) {
            return { rows: [{ dernier_drop_pack_at: new Date().toISOString() }], rowCount: 1, ok: true }
        }
        if (sql.includes("insert into inventaire_packs")) {
            return { rows: [{ id_pack: 1, quantite: 3 }], rowCount: 1, ok: true }
        }
        return { rows: [], rowCount: 0, ok: true }
    })

    const { response, body } = await request("/inventaire-pack/open", {
        method: "POST",
        headers: { ...authenticatedHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ id_pack: 1 }),
    })

    assert.equal(response.status, 200)
    assert.equal(body.message, "Pack réclamé avec succès !")
    assert.equal(body.quantite, 3)
    assert.equal(body.cooldownRemainingSeconds, 24 * 3600)
})
