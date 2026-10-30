import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
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

test("POST /inventaire-pack/:idPack exige une authentification", async () => {
    const { response, body } = await request("/inventaire-pack/1", {
        method: "POST",
    })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("POST /inventaire-pack/:idPack refuse si le cooldown de 24h est actif", async () => {
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

    const { response, body } = await request("/inventaire-pack/1", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 429)
    assert.match(body.error, /24h/)
    assert.ok(body.cooldownRemainingSeconds > 0)
})

test("POST /inventaire-pack/:idPack réclame le pack si éligible", async () => {
    setQueryResult((sql) => {
        if (sql.includes("where id_pack = $1")) {
            return { rows: [{ id_pack: 1, nom_pack: "Pack Alpha" }], rowCount: 1, ok: true }
        }
        if (sql.includes("update utilisateurs")) {
            return { rows: [{ dernier_drop_pack_at: new Date().toISOString() }], rowCount: 1, ok: true }
        }
        if (sql.includes("insert into inventaire_packs")) {
            return { rows: [{ id_pack: 1, quantite: 3 }], rowCount: 1, ok: true }
        }
        return { rows: [], rowCount: 0, ok: true }
    })

    const { response, body } = await request("/inventaire-pack/1", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 200)
    assert.equal(body.message, "Pack réclamé avec succès !")
    assert.equal(body.quantite, 3)
    assert.equal(body.cooldownRemainingSeconds, 24 * 3600)
})

test("POST /inventaire-pack/:idPack refuse un identifiant invalide", async () => {
    const { response, body } = await request("/inventaire-pack/abc", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 400)
    assert.equal(body.error, "Identifiant de pack invalide")
})

test("POST /inventaire-pack/:idPack/open ouvre et retire le pack de l'inventaire", async () => {
    setQueryResult((sql) => {
        if (sql.includes("select quantite from inventaire_packs")) {
            return { rows: [{ quantite: 2 }], rowCount: 1, ok: true, }
        }

        if (sql.includes("update inventaire_packs ip")) {
            return {
                rows: [{
                    id_pack: 1,
                    nom_pack: "Pack Alpha",
                    image_pack: "alpha.png",
                    description_pack: "Description",
                    liste_carte: [],
                    quantite: 1,
                }],
                rowCount: 1,
                ok: true,
            }
        }
    })

    const { response, body } = await request("/inventaire-pack/1/open", {
        method: "POST",
        headers: { ...authenticatedHeaders(), "content-type": "application/json" }
    })

    assert.equal(response.status, 200)
    assert.equal(body.pack.id_pack, 1)
    assert.equal(body.pack.nom_pack, "Pack Alpha")
    assert.equal(body.pack.image_pack, "alpha.png")
    assert.equal(body.pack.description_pack, "Description")
    // deep equal check le contenu du tableau, si juste equal donne une erreur
    assert.deepEqual(body.pack.liste_carte, [])
    assert.equal(body.quantite, 1)


})


// =============================================================
// MIDDLEWARES D'AUTHENTIFICATION (checkAuth / checkAdmin)
// =============================================================

test("checkAuth refuse un en-tête Authorization sans Bearer", async () => {
    const { response, body } = await request("/collection/all", {
        headers: { authorization: "Basic abc123" },
    })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("checkAuth refuse un token invalide", async () => {
    const { response, body } = await request("/collection/all", {
        headers: { authorization: "Bearer token-invalide" },
    })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Token invalide ou expiré")
})

test("checkAuth refuse un token expiré", async () => {
    const expired = jwt.sign({ id: 7 }, process.env.JWT_SECRET, { expiresIn: -10 })
    const { response, body } = await request("/collection/all", {
        headers: { authorization: `Bearer ${expired}` },
    })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Token invalide ou expiré")
})

test("checkAuth refuse un token signé avec un autre secret", async () => {
    const forged = jwt.sign({ id: 7, statut: "admin" }, "un-autre-secret")
    const { response, body } = await request("/collection/all", {
        headers: { authorization: `Bearer ${forged}` },
    })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Token invalide ou expiré")
})

test("checkAdmin refuse l'absence de token", async () => {
    const { response, body } = await request("/collection/1", { method: "DELETE" })

    assert.equal(response.status, 401)
    assert.equal(body.message, "Accès refusé. Token manquant.")
})

test("checkAdmin refuse un token invalide", async () => {
    const { response, body } = await request("/collection/1", {
        method: "DELETE",
        headers: { authorization: "Bearer token-invalide" },
    })

    assert.equal(response.status, 401)
    assert.equal(body.message, "Token invalide ou expiré")
})

test("checkAdmin refuse un joueur qui n'est pas administrateur", async () => {
    const { response, body } = await request("/collection/1", {
        method: "DELETE",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 403)
    assert.equal(body.message, "Accès refusé")
})

// =============================================================
// /auth
// =============================================================

test("POST /auth/signup refuse un mot de passe de moins de 8 caractères", async () => {
    const { response, body } = await request("/auth/signup", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ nom_utilisateur: "joueur", email: "joueur@example.com", password: "court" }),
    })

    assert.equal(response.status, 400)
    assert.equal(body.error, "Le mot de passe doit contenir au moins 8 caractères")
})

test("POST /auth/signup crée un compte et ne stocke jamais le mot de passe en clair", async () => {
    let insertParams
    setQueryResult((sql, params) => {
        if (sql.includes("insert into utilisateurs")) {
            insertParams = params
            return {
                rows: [{ id: 9, nom_utilisateur: "nouveau", email: "nouveau@example.com", cree_le: "2026-01-01T00:00:00.000Z" }],
                rowCount: 1,
            }
        }
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/auth/signup", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ nom_utilisateur: "nouveau", email: "nouveau@example.com", password: "motdepasse" }),
    })

    assert.equal(response.status, 201)
    assert.equal(body.user.id, 9)
    assert.equal(body.user.mot_de_passe_hash, undefined)
    assert.notEqual(insertParams[2], "motdepasse")
    assert.ok(await bcrypt.compare("motdepasse", insertParams[2]))
})

test("POST /auth/signup retourne 409 si la contrainte UNIQUE est violée (race condition)", async () => {
    setQueryResult((sql) => {
        if (sql.includes("insert into utilisateurs")) {
            throw Object.assign(new Error("duplicate key"), { code: "23505" })
        }
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/auth/signup", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ nom_utilisateur: "joueur", email: "joueur@example.com", password: "motdepasse" }),
    })

    assert.equal(response.status, 409)
    assert.equal(body.error, "Email ou nom d'utilisateur déjà utilisé")
})

test("POST /auth/signup retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/auth/signup", {
            method: "POST",
            headers: jsonHeaders(),
            body: JSON.stringify({ nom_utilisateur: "joueur", email: "joueur@example.com", password: "motdepasse" }),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("POST /auth/login refuse un email inconnu", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/auth/login", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ email: "inconnu@example.com", password: "motdepasse" }),
    })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Email ou mot de passe incorrect")
})

test("POST /auth/login refuse un mauvais mot de passe avec le même message", async () => {
    const hash = await bcrypt.hash("bon-mot-de-passe", 10)
    setQueryResult({
        rows: [{ id: 7, nom_utilisateur: "joueur", email: "joueur@example.com", mot_de_passe_hash: hash, statut: "actif" }],
        rowCount: 1,
    })

    const { response, body } = await request("/auth/login", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ email: "joueur@example.com", password: "mauvais-mot-de-passe" }),
    })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Email ou mot de passe incorrect")
})

test("POST /auth/login refuse la connexion par mot de passe d'un compte GitHub sans mot de passe local", async () => {
    setQueryResult({
        rows: [{ id: 8, nom_utilisateur: "gh-user", email: "gh@example.com", mot_de_passe_hash: null, statut: "actif" }],
        rowCount: 1,
    })

    const { response, body } = await request("/auth/login", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ email: "gh@example.com", password: "nimportequoi" }),
    })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Email ou mot de passe incorrect")
})

test("POST /auth/login retourne un JWT de 2h et les infos publiques sans le hash", async () => {
    const hash = await bcrypt.hash("bon-mot-de-passe", 10)
    setQueryResult({
        rows: [{ id: 7, nom_utilisateur: "joueur", email: "joueur@example.com", mot_de_passe_hash: hash, statut: "actif" }],
        rowCount: 1,
    })

    const { response, body } = await request("/auth/login", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ email: "joueur@example.com", password: "bon-mot-de-passe" }),
    })

    assert.equal(response.status, 200)
    const payload = jwt.verify(body.token, process.env.JWT_SECRET)
    assert.equal(payload.id, 7)
    assert.equal(payload.nom_utilisateur, "joueur")
    assert.equal(payload.statut, "actif")
    assert.equal(payload.exp - payload.iat, 2 * 60 * 60)
    assert.deepEqual(body.user, { id: 7, nom_utilisateur: "joueur", email: "joueur@example.com" })
})

test("POST /auth/login retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/auth/login", {
            method: "POST",
            headers: jsonHeaders(),
            body: JSON.stringify({ email: "joueur@example.com", password: "motdepasse" }),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("POST /auth/check-email exige un email", async () => {
    const { response, body } = await request("/auth/check-email", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({}),
    })

    assert.equal(response.status, 400)
    assert.equal(body.error, "Email requis")
})

test("POST /auth/check-email indique qu'un email est libre", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/auth/check-email", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ email: "libre@example.com" }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(body, { exists: false })
})

test("POST /auth/check-email retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/auth/check-email", {
            method: "POST",
            headers: jsonHeaders(),
            body: JSON.stringify({ email: "joueur@example.com" }),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("GET /auth/whoAmI exige une authentification", async () => {
    const { response, body } = await request("/auth/whoAmI")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("GET /auth/whoAmI retourne l'utilisateur connecté", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ id: 7, nom_utilisateur: "joueur", credits: 1000 }], rowCount: 1 }
    })

    const { response, body } = await request("/auth/whoAmI", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.id, 7)
    assert.equal(body.credits, 1000)
    assert.deepEqual(queryParams, [7])
})

test("GET /auth/whoAmI retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/auth/whoAmI", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("PUT /auth/makeMeAdmin exige une authentification", async () => {
    const { response, body } = await request("/auth/makeMeAdmin", { method: "PUT" })

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("PUT /auth/makeMeAdmin passe l'utilisateur connecté au statut admin", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [], rowCount: 1 }
    })

    const { response, body } = await request("/auth/makeMeAdmin", {
        method: "PUT",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 204)
    assert.equal(body, null)
    assert.deepEqual(queryParams, ["admin", 7])
})

test("PUT /auth/makeMeAdmin retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/auth/makeMeAdmin", {
            method: "PUT",
            headers: authenticatedHeaders(),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

// =============================================================
// /collection
// =============================================================

const carteValide = {
    nomCarte: "Carte test",
    image: "image.png",
    description: "Une carte",
    rarete: "1",
    valeur: "10",
    mana: "2",
    health: "5",
    damage: "3",
}

test("GET /collection/all exige une authentification", async () => {
    const { response, body } = await request("/collection/all")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("GET /collection/all retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/collection/all", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("GET /collection/:id exige une authentification", async () => {
    const { response, body } = await request("/collection/3")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("GET /collection/:id retourne 404 si la carte n'existe pas", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/collection/999", { headers: authenticatedHeaders() })

    assert.equal(response.status, 404)
    assert.equal(body.erreur, "Id non trouvé dans la bd.")
})

test("GET /collection/:id retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/collection/3", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("POST /collection/card exige un token", async () => {
    const { response, body } = await request("/collection/card", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(carteValide),
    })

    assert.equal(response.status, 401)
    assert.equal(body.message, "Accès refusé. Token manquant.")
})

test("POST /collection/card refuse un joueur qui n'est pas admin", async () => {
    const { response, body } = await request("/collection/card", {
        method: "POST",
        headers: jsonHeaders(authenticatedHeaders()),
        body: JSON.stringify(carteValide),
    })

    assert.equal(response.status, 403)
    assert.equal(body.message, "Accès refusé")
})

// Chaque couple [champ, valeur] est hors des bornes autorisées par reglesCartes
for (const [champ, valeur] of [
    ["rarete", "0"],
    ["rarete", "5"],
    ["valeur", "0"],
    ["valeur", "1001"],
    ["mana", "-1"],
    ["mana", "11"],
    ["health", "0"],
    ["health", "1001"],
    ["damage", "-1"],
    ["damage", "1001"],
    ["rarete", "abc"],
]) {
    test(`POST /collection/card refuse ${champ} = ${valeur}`, async () => {
        const { response, body } = await request("/collection/card", {
            method: "POST",
            headers: jsonHeaders(adminHeaders()),
            body: JSON.stringify({ ...carteValide, [champ]: valeur }),
        })

        assert.equal(response.status, 400)
        assert.ok(body.erreurs.some((error) => error.path === champ))
    })
}

test("POST /collection/card accepte les valeurs limites autorisées", async () => {
    setQueryResult({ rows: [{ id_carte: 10 }], rowCount: 1 })

    const { response } = await request("/collection/card", {
        method: "POST",
        headers: jsonHeaders(adminHeaders()),
        body: JSON.stringify({ ...carteValide, rarete: "4", valeur: "1000", mana: "0", health: "1000", damage: "0" }),
    })

    assert.equal(response.status, 201)
})

test("POST /collection/card utilise « Aucune description » quand la description est absente", async () => {
    let insertParams
    setQueryResult((sql, params) => {
        insertParams = params
        return { rows: [{ id_carte: 11 }], rowCount: 1 }
    })
    const { description, ...sansDescription } = carteValide

    const { response } = await request("/collection/card", {
        method: "POST",
        headers: jsonHeaders(adminHeaders()),
        body: JSON.stringify(sansDescription),
    })

    assert.equal(response.status, 201)
    assert.equal(insertParams[2], "Aucune description")
})

test("POST /collection/card retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/collection/card", {
            method: "POST",
            headers: jsonHeaders(adminHeaders()),
            body: JSON.stringify(carteValide),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("PATCH /collection/:id exige un token", async () => {
    const { response } = await request("/collection/3", {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ mana: 4 }),
    })

    assert.equal(response.status, 401)
})

test("PATCH /collection/:id refuse un joueur qui n'est pas admin", async () => {
    const { response, body } = await request("/collection/3", {
        method: "PATCH",
        headers: jsonHeaders(authenticatedHeaders()),
        body: JSON.stringify({ mana: 4 }),
    })

    assert.equal(response.status, 403)
    assert.equal(body.message, "Accès refusé")
})

test("PATCH /collection/:id refuse une requête sans aucun champ", async () => {
    const { response, body } = await request("/collection/3", {
        method: "PATCH",
        headers: jsonHeaders(adminHeaders()),
        body: JSON.stringify({}),
    })

    assert.equal(response.status, 400)
    assert.equal(body.message, "Aucun champ à mettre à jour")
})

test("PATCH /collection/:id ne met à jour que les champs envoyés", async () => {
    let queryText
    let queryParams
    setQueryResult((sql, params) => {
        queryText = sql
        queryParams = params
        return { rows: [{ id_carte: 3, nom_carte: "Nouveau nom", mana: 4 }], rowCount: 1 }
    })

    const { response, body } = await request("/collection/3", {
        method: "PATCH",
        headers: jsonHeaders(adminHeaders()),
        body: JSON.stringify({ nomCarte: "Nouveau nom", mana: 4 }),
    })

    assert.equal(response.status, 200)
    assert.equal(body.nom_carte, "Nouveau nom")
    assert.match(queryText, /"nom_carte" = \$1, "mana" = \$2/)
    assert.match(queryText, /WHERE id_carte = \$3/)
    assert.deepEqual(queryParams, ["Nouveau nom", 4, "3"])
})

test("PATCH /collection/:id retourne 404 si la carte est introuvable", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/collection/999", {
        method: "PATCH",
        headers: jsonHeaders(adminHeaders()),
        body: JSON.stringify({ mana: 4 }),
    })

    assert.equal(response.status, 404)
    assert.equal(body.message, "Carte non trouvée")
})

test("PATCH /collection/:id retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/collection/3", {
            method: "PATCH",
            headers: jsonHeaders(adminHeaders()),
            body: JSON.stringify({ mana: 4 }),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("DELETE /collection/:id supprime la carte et retourne 204", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [], rowCount: 1 }
    })

    const { response, body } = await request("/collection/3", {
        method: "DELETE",
        headers: adminHeaders(),
    })

    assert.equal(response.status, 204)
    assert.equal(body, null)
    assert.deepEqual(queryParams, ["3"])
})

test("DELETE /collection/:id retourne 404 si la carte est introuvable", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/collection/999", {
        method: "DELETE",
        headers: adminHeaders(),
    })

    assert.equal(response.status, 404)
    assert.equal(body.message, "Carte non trouvée")
})

test("DELETE /collection/:id retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/collection/3", {
            method: "DELETE",
            headers: adminHeaders(),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

// =============================================================
// /api/card/:id
// =============================================================

test("GET /api/card/:id retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/api/card/5")

        assert.equal(response.status, 500)
        assert.equal(body.message, "Erreur serveur")
    })
})

// =============================================================
// /inventaire et /carteInventaire (inventaire de cartes par utilisateur)
// =============================================================

test("GET /inventaire/:id_user retourne une liste vide si l'inventaire est vide", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/inventaire/7")

    assert.equal(response.status, 200)
    assert.deepEqual(body, { message: "Aucune carte dans l'inventaire", cartes: [] })
})

test("GET /inventaire/:id_user retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventaire/7")

        assert.equal(response.status, 500)
        assert.equal(body.message, "Erreur serveur")
    })
})

test("POST /carteInventaire/:id_user/:id_carte incrémente la quantité si la carte existe déjà", async () => {
    let queryText
    let queryParams
    setQueryResult((sql, params) => {
        queryText = sql
        queryParams = params
        return { rows: [{ id_utilisateur: 7, id_carte: 5, quantite: 2 }], rowCount: 1 }
    })

    const { response, body } = await request("/carteInventaire/7/5", { method: "POST" })

    assert.equal(response.status, 201)
    assert.equal(body.message, "Carte ajoutée à l'inventaire")
    assert.equal(body.newCard.quantite, 2)
    assert.match(queryText, /on conflict \(id_utilisateur, id_carte\)/i)
    assert.deepEqual(queryParams, ["7", "5"])
})

test("POST /carteInventaire/:id_user/:id_carte retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/carteInventaire/7/5", { method: "POST" })

        assert.equal(response.status, 500)
        assert.equal(body.message, "Erreur serveur")
    })
})

test("DELETE /carteInventaire/:id_user/:id_carte retourne 404 si la carte n'est pas dans l'inventaire", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/carteInventaire/7/999", { method: "DELETE" })

    assert.equal(response.status, 404)
    assert.equal(body.message, "Carte non trouvée dans l'inventaire")
})

test("DELETE /carteInventaire/:id_user/:id_carte retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/carteInventaire/7/5", { method: "DELETE" })

        assert.equal(response.status, 500)
        assert.equal(body.message, "Erreur serveur")
    })
})

// =============================================================
// /inventory (decks) : toutes les routes exigent une authentification
// =============================================================

for (const [method, chemin] of [
    ["GET", "/inventory/cards"],
    ["GET", "/inventory/decks"],
    ["GET", "/inventory/decks/1"],
    ["POST", "/inventory/decks"],
    ["POST", "/inventory/decks/1/cards/2"],
    ["DELETE", "/inventory/decks/1/cards/2"],
    ["PATCH", "/inventory/decks/1"],
    ["DELETE", "/inventory/decks/1"],
]) {
    test(`${method} ${chemin} exige une authentification`, async () => {
        const { response, body } = await request(chemin, { method })

        assert.equal(response.status, 401)
        assert.equal(body.error, "Authentification requise")
    })
}

test("GET /inventory/cards filtre sur l'utilisateur connecté", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/inventory/cards", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.deepEqual(body, [])
    assert.deepEqual(queryParams, [7])
})

test("GET /inventory/cards retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventory/cards", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("GET /inventory/decks retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventory/decks", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("GET /inventory/decks/:id retourne le deck et ses cartes", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return {
            rows: [{ id_deck: 3, nom_deck: "Mon deck", cartes: [{ id_carte: 5, nom_carte: "Carte test", quantite: 2 }] }],
            rowCount: 1,
        }
    })

    const { response, body } = await request("/inventory/decks/3", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body.id_deck, 3)
    assert.equal(body.cartes[0].quantite, 2)
    // le deck est cherché pour l'utilisateur connecté seulement
    assert.deepEqual(queryParams, ["3", 7])
})

test("GET /inventory/decks/:id retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventory/decks/3", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("POST /inventory/decks refuse un nom de plus de 30 caractères", async () => {
    const { response, body } = await request("/inventory/decks", {
        method: "POST",
        headers: jsonHeaders(authenticatedHeaders()),
        body: JSON.stringify({ nomDeck: "x".repeat(31) }),
    })

    assert.equal(response.status, 400)
    assert.match(body.error, /30 caractères/)
})

test("POST /inventory/decks refuse un nom qui n'est pas une chaîne", async () => {
    const { response, body } = await request("/inventory/decks", {
        method: "POST",
        headers: jsonHeaders(authenticatedHeaders()),
        body: JSON.stringify({ nomDeck: 123 }),
    })

    assert.equal(response.status, 400)
    assert.match(body.error, /nom du deck est requis/)
})

test("POST /inventory/decks accepte un nom de 30 caractères et le trim", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ id_deck: 4, nom_deck: "x".repeat(30) }], rowCount: 1 }
    })

    const { response } = await request("/inventory/decks", {
        method: "POST",
        headers: jsonHeaders(authenticatedHeaders()),
        body: JSON.stringify({ nomDeck: `  ${"x".repeat(30)}  ` }),
    })

    assert.equal(response.status, 201)
    assert.deepEqual(queryParams, [7, "x".repeat(30)])
})

test("POST /inventory/decks retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventory/decks", {
            method: "POST",
            headers: jsonHeaders(authenticatedHeaders()),
            body: JSON.stringify({ nomDeck: "Deck" }),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

// Simule la transaction d'ajout d'une carte à un deck et enregistre les requêtes exécutées
function mockTransactionDeck({ deck = [{ id_deck: 3 }], carte = [{ id_carte: 5 }], possession = [{ quantite: 2 }], dansDeck = [] } = {}, appels = []) {
    setQueryResult((sql, params) => {
        const requete = sql.replace(/\s+/g, " ").trim().toLowerCase()
        appels.push(requete)

        if (requete.includes("from deck where")) return { rows: deck, rowCount: deck.length }
        if (requete.includes("from carte where")) return { rows: carte, rowCount: carte.length }
        if (requete.includes("from inventaire_carte")) return { rows: possession, rowCount: possession.length }
        if (requete.includes("from deck_carte where")) return { rows: dansDeck, rowCount: dansDeck.length }
        if (requete.includes("insert into deck_carte")) {
            return { rows: [{ id_deck: 3, id_carte: 5, quantite: params[2] }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
    })
}

test("POST /inventory/decks/:id/cards/:idCarte ajoute la carte au deck (transaction validée)", async () => {
    const appels = []
    mockTransactionDeck({}, appels)

    const { response, body } = await request("/inventory/decks/3/cards/5", {
        method: "POST",
        headers: jsonHeaders(authenticatedHeaders()),
        body: JSON.stringify({ quantite: 2 }),
    })

    assert.equal(response.status, 201)
    assert.deepEqual(body, { id_deck: 3, id_carte: 5, quantite: 2 })
    assert.equal(appels[0], "begin")
    assert.ok(appels.includes("commit"))
    assert.ok(!appels.includes("rollback"))
})

test("POST /inventory/decks/:id/cards/:idCarte ajoute 1 exemplaire par défaut", async () => {
    mockTransactionDeck()

    const { response, body } = await request("/inventory/decks/3/cards/5", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 201)
    assert.equal(body.quantite, 1)
})

test("POST /inventory/decks/:id/cards/:idCarte retourne 404 si le deck n'appartient pas à l'utilisateur", async () => {
    const appels = []
    mockTransactionDeck({ deck: [] }, appels)

    const { response, body } = await request("/inventory/decks/3/cards/5", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Deck introuvable")
    assert.ok(appels.includes("rollback"))
})

test("POST /inventory/decks/:id/cards/:idCarte retourne 404 si la carte n'existe pas", async () => {
    const appels = []
    mockTransactionDeck({ carte: [] }, appels)

    const { response, body } = await request("/inventory/decks/3/cards/999", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Carte introuvable")
    assert.ok(appels.includes("rollback"))
})

test("POST /inventory/decks/:id/cards/:idCarte retourne 409 si le joueur n'a pas assez d'exemplaires", async () => {
    const appels = []
    // possède 1 exemplaire, 1 est déjà dans le deck : en ajouter un autre dépasse l'inventaire
    mockTransactionDeck({ possession: [{ quantite: 1 }], dansDeck: [{ quantite: 1 }] }, appels)

    const { response, body } = await request("/inventory/decks/3/cards/5", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 409)
    assert.equal(body.error, "Quantité de cartes insuffisante dans l'inventaire")
    assert.ok(appels.includes("rollback"))
    assert.ok(!appels.includes("commit"))
})

test("POST /inventory/decks/:id/cards/:idCarte retourne 409 si le joueur ne possède pas la carte", async () => {
    mockTransactionDeck({ possession: [] })

    const { response, body } = await request("/inventory/decks/3/cards/5", {
        method: "POST",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 409)
    assert.equal(body.error, "Quantité de cartes insuffisante dans l'inventaire")
})

test("POST /inventory/decks/:id/cards/:idCarte annule la transaction et retourne 500 sur erreur", async () => {
    await withSilentErrors(async () => {
        const appels = []
        setQueryResult((sql) => {
            const requete = sql.replace(/\s+/g, " ").trim().toLowerCase()
            appels.push(requete)
            if (requete.includes("from deck where")) throw new Error("Erreur de base de données simulée")
            return { rows: [], rowCount: 0 }
        })

        const { response, body } = await request("/inventory/decks/3/cards/5", {
            method: "POST",
            headers: authenticatedHeaders(),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
        assert.ok(appels.includes("rollback"))
    })
})

test("DELETE /inventory/decks/:id/cards/:idCarte retire la carte du deck et retourne 204", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ id_deck: 3, id_carte: 5 }], rowCount: 1 }
    })

    const { response, body } = await request("/inventory/decks/3/cards/5", {
        method: "DELETE",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 204)
    assert.equal(body, null)
    assert.deepEqual(queryParams, ["3", "5", 7])
})

test("DELETE /inventory/decks/:id/cards/:idCarte retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventory/decks/3/cards/5", {
            method: "DELETE",
            headers: authenticatedHeaders(),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("PATCH /inventory/decks/:id refuse un nom de plus de 30 caractères", async () => {
    const { response, body } = await request("/inventory/decks/3", {
        method: "PATCH",
        headers: jsonHeaders(authenticatedHeaders()),
        body: JSON.stringify({ nomDeck: "x".repeat(31) }),
    })

    assert.equal(response.status, 400)
    assert.match(body.error, /30 caractères/)
})

test("PATCH /inventory/decks/:id retourne 404 si le deck est introuvable", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/inventory/decks/99", {
        method: "PATCH",
        headers: jsonHeaders(authenticatedHeaders()),
        body: JSON.stringify({ nomDeck: "Nouveau nom" }),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Deck introuvable")
})

test("PATCH /inventory/decks/:id retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventory/decks/3", {
            method: "PATCH",
            headers: jsonHeaders(authenticatedHeaders()),
            body: JSON.stringify({ nomDeck: "Nouveau nom" }),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("DELETE /inventory/decks/:id supprime le deck de l'utilisateur et retourne 204", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ id_deck: 3 }], rowCount: 1 }
    })

    const { response, body } = await request("/inventory/decks/3", {
        method: "DELETE",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 204)
    assert.equal(body, null)
    assert.deepEqual(queryParams, ["3", 7])
})

test("DELETE /inventory/decks/:id retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/inventory/decks/3", {
            method: "DELETE",
            headers: authenticatedHeaders(),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

// =============================================================
// /pack (gestion des packs : lecture pour les joueurs, écriture pour les admins)
// =============================================================

const packValide = {
    nom_pack: "Pack Alpha",
    image_pack: "alpha.png",
    description_pack: "Description",
    liste_carte: [1, 2, 3],
    valeur_pack: 100,
}

test("GET /pack exige une authentification", async () => {
    const { response, body } = await request("/pack")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("GET /pack retourne la liste des packs", async () => {
    setQueryResult({ rows: [{ id_pack: 1, nom_pack: "Pack Alpha" }], rowCount: 1 })

    const { response, body } = await request("/pack", { headers: authenticatedHeaders() })

    assert.equal(response.status, 200)
    assert.equal(body[0].nom_pack, "Pack Alpha")
})

test("GET /pack retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/pack", { headers: authenticatedHeaders() })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("POST /pack exige un token", async () => {
    const { response } = await request("/pack", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(packValide),
    })

    assert.equal(response.status, 401)
})

test("POST /pack refuse un joueur qui n'est pas admin", async () => {
    const { response, body } = await request("/pack", {
        method: "POST",
        headers: jsonHeaders(authenticatedHeaders()),
        body: JSON.stringify(packValide),
    })

    assert.equal(response.status, 403)
    assert.equal(body.message, "Accès refusé")
})

for (const champ of ["nom_pack", "image_pack", "description_pack", "liste_carte", "valeur_pack"]) {
    test(`POST /pack refuse une requête sans ${champ}`, async () => {
        const { [champ]: retire, ...incomplet } = packValide

        const { response, body } = await request("/pack", {
            method: "POST",
            headers: jsonHeaders(adminHeaders()),
            body: JSON.stringify(incomplet),
        })

        assert.equal(response.status, 400)
        assert.equal(body.error, "Données manquantes ou invalides")
    })
}

test("POST /pack refuse une liste_carte qui n'est pas un tableau", async () => {
    const { response, body } = await request("/pack", {
        method: "POST",
        headers: jsonHeaders(adminHeaders()),
        body: JSON.stringify({ ...packValide, liste_carte: "1,2,3" }),
    })

    assert.equal(response.status, 400)
    assert.equal(body.error, "Données manquantes ou invalides")
})

test("POST /pack crée un pack", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ id_pack: 5, ...packValide }], rowCount: 1 }
    })

    const { response, body } = await request("/pack", {
        method: "POST",
        headers: jsonHeaders(adminHeaders()),
        body: JSON.stringify(packValide),
    })

    assert.equal(response.status, 201)
    assert.equal(body.id_pack, 5)
    assert.deepEqual(queryParams, ["Pack Alpha", "alpha.png", "Description", [1, 2, 3], 100])
})

test("POST /pack retourne 409 si le nom du pack existe déjà", async () => {
    setQueryError(Object.assign(new Error("duplicate key"), { code: "23505" }))

    await withSilentErrors(async () => {
        const { response, body } = await request("/pack", {
            method: "POST",
            headers: jsonHeaders(adminHeaders()),
            body: JSON.stringify(packValide),
        })

        assert.equal(response.status, 409)
        assert.equal(body.error, 'Le pack "Pack Alpha" existe déjà.')
    })
})

test("POST /pack retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/pack", {
            method: "POST",
            headers: jsonHeaders(adminHeaders()),
            body: JSON.stringify(packValide),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("PUT /pack/:id refuse un joueur qui n'est pas admin", async () => {
    const { response, body } = await request("/pack/5", {
        method: "PUT",
        headers: jsonHeaders(authenticatedHeaders()),
        body: JSON.stringify(packValide),
    })

    assert.equal(response.status, 403)
    assert.equal(body.message, "Accès refusé")
})

test("PUT /pack/:id modifie un pack", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ id_pack: 5, ...packValide, nom_pack: "Pack Beta" }], rowCount: 1 }
    })

    const { response, body } = await request("/pack/5", {
        method: "PUT",
        headers: jsonHeaders(adminHeaders()),
        body: JSON.stringify({ ...packValide, nom_pack: "Pack Beta" }),
    })

    assert.equal(response.status, 200)
    assert.equal(body.nom_pack, "Pack Beta")
    assert.deepEqual(queryParams, ["Pack Beta", "alpha.png", "Description", [1, 2, 3], 100, "5"])
})

test("PUT /pack/:id retourne 404 si le pack est introuvable", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/pack/999", {
        method: "PUT",
        headers: jsonHeaders(adminHeaders()),
        body: JSON.stringify(packValide),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Pack non trouvé")
})

test("PUT /pack/:id retourne 409 si le nom du pack existe déjà", async () => {
    setQueryError(Object.assign(new Error("duplicate key"), { code: "23505" }))

    await withSilentErrors(async () => {
        const { response, body } = await request("/pack/5", {
            method: "PUT",
            headers: jsonHeaders(adminHeaders()),
            body: JSON.stringify(packValide),
        })

        assert.equal(response.status, 409)
        assert.equal(body.error, 'Le pack "Pack Alpha" existe déjà.')
    })
})

test("PUT /pack/:id retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/pack/5", {
            method: "PUT",
            headers: jsonHeaders(adminHeaders()),
            body: JSON.stringify(packValide),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})

test("DELETE /pack/:id refuse un joueur qui n'est pas admin", async () => {
    const { response, body } = await request("/pack/5", {
        method: "DELETE",
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 403)
    assert.equal(body.message, "Accès refusé")
})

test("DELETE /pack/:id supprime le pack et le retourne", async () => {
    let queryParams
    setQueryResult((sql, params) => {
        queryParams = params
        return { rows: [{ id_pack: 5, nom_pack: "Pack Alpha" }], rowCount: 1 }
    })

    const { response, body } = await request("/pack/5", {
        method: "DELETE",
        headers: adminHeaders(),
    })

    assert.equal(response.status, 200)
    assert.equal(body.id_pack, 5)
    assert.deepEqual(queryParams, ["5"])
})

test("DELETE /pack/:id retourne 404 si le pack est introuvable", async () => {
    setQueryResult({ rows: [], rowCount: 0 })

    const { response, body } = await request("/pack/999", {
        method: "DELETE",
        headers: adminHeaders(),
    })

    assert.equal(response.status, 404)
    assert.equal(body.error, "Pack non trouvé")
})

test("DELETE /pack/:id retourne 500 sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const { response, body } = await request("/pack/5", {
            method: "DELETE",
            headers: adminHeaders(),
        })

        assert.equal(response.status, 500)
        assert.equal(body.error, "Erreur serveur")
    })
})