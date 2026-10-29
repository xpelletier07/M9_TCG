import test, { after, before, beforeEach } from "node:test"
import assert from "node:assert/strict"
import bcrypt from "bcrypt"
import {
    authenticatedHeaders,
    request,
    setQueryResult,
    startTestServer,
    stopTestServer,
} from "./app.test.js"

before(async () => {
    await startTestServer()
})

after(async () => {
    await stopTestServer()
})

beforeEach(() => {
    setQueryResult({ rows: [], rowCount: 0 })
})

test("GET /settings/profile exige une authentification", async () => {
    const { response, body } = await request("/settings/profile", {
        headers: {},
    })

    assert.equal(response.status, 401)
    assert.match(body.error, /Authentification requise/)
})

test("GET /settings/profile retourne les informations de l'utilisateur", async () => {
    setQueryResult({
        rows: [
            {
                id: 7,
                nom_utilisateur: "joueur",
                email: "joueur@m9tcg.local",
                avatar_url: "https://example.com/avatar.png",
                credits: 500,
                statut: "actif",
                cree_le: "2026-01-01T00:00:00.000Z",
                github_id: null,
            },
        ],
        rowCount: 1,
    })

    const { response, body } = await request("/settings/profile", {
        headers: authenticatedHeaders(),
    })

    assert.equal(response.status, 200)
    assert.equal(body.nom_utilisateur, "joueur")
    assert.equal(body.email, "joueur@m9tcg.local")
    assert.equal(body.avatar_url, "https://example.com/avatar.png")
})

test("PUT /settings/profile valide le nom d'utilisateur et l'email", async () => {
    const { response: res1, body: body1 } = await request("/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ nom_utilisateur: "ab" }),
    })
    assert.equal(res1.status, 400)
    assert.match(body1.error, /au moins 3 caractères/)

    const { response: res2, body: body2 } = await request("/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ email: "invalid-email" }),
    })
    assert.equal(res2.status, 400)
    assert.match(body2.error, /Format d'email invalide/)
})

test("PUT /settings/profile détecte les doublons d'email ou de nom d'utilisateur", async () => {
    setQueryResult({
        rows: [{ id: 99 }],
        rowCount: 1,
    })

    const { response, body } = await request("/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ nom_utilisateur: "autreJoueur", email: "autre@tcg.com" }),
    })

    assert.equal(response.status, 409)
    assert.match(body.error, /déjà utilisé/)
})

test("PUT /settings/profile met à jour le profil avec succès", async () => {
    let callCount = 0
    setQueryResult(async (query, params) => {
        callCount++
        if (query.includes("SELECT id FROM utilisateurs WHERE")) {
            return { rows: [], rowCount: 0 }
        }
        if (query.includes("UPDATE utilisateurs")) {
            return {
                rows: [
                    {
                        id: 7,
                        nom_utilisateur: "nouveauNom",
                        email: "nouveau@tcg.com",
                        avatar_url: "https://example.com/new.png",
                        credits: 500,
                        statut: "actif",
                    },
                ],
                rowCount: 1,
            }
        }
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({
            nom_utilisateur: "nouveauNom",
            email: "nouveau@tcg.com",
            avatar_url: "https://example.com/new.png",
        }),
    })

    assert.equal(response.status, 200)
    assert.equal(body.user.nom_utilisateur, "nouveauNom")
    assert.equal(body.user.email, "nouveau@tcg.com")
})

test("PUT /settings/password refuse un mot de passe trop court", async () => {
    const { response, body } = await request("/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ currentPassword: "Password123!", newPassword: "short" }),
    })

    assert.equal(response.status, 400)
    assert.match(body.error, /au moins 8 caractères/)
})

test("PUT /settings/password refuse un ancien mot de passe erroné", async () => {
    const hash = await bcrypt.hash("OldPassword123!", 10)
    setQueryResult({
        rows: [{ id: 7, mot_de_passe_hash: hash, github_id: null }],
        rowCount: 1,
    })

    const { response, body } = await request("/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ currentPassword: "WrongPassword!", newPassword: "NewSecretPassword123!" }),
    })

    assert.equal(response.status, 401)
    assert.match(body.error, /actuel incorrect/)
})

test("PUT /settings/password met à jour le mot de passe quand valide", async () => {
    const hash = await bcrypt.hash("OldPassword123!", 10)
    setQueryResult(async (query, params) => {
        if (query.includes("SELECT id, mot_de_passe_hash")) {
            return { rows: [{ id: 7, mot_de_passe_hash: hash, github_id: null }], rowCount: 1 }
        }
        if (query.includes("UPDATE utilisateurs SET mot_de_passe_hash")) {
            return { rows: [], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
    })

    const { response, body } = await request("/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ currentPassword: "OldPassword123!", newPassword: "BrandNewPassword123!" }),
    })

    assert.equal(response.status, 200)
    assert.match(body.message, /avec succès/)
})

test("PUT /settings/avatar met à jour la photo de profil", async () => {
    setQueryResult({
        rows: [
            {
                id: 7,
                nom_utilisateur: "joueur",
                email: "joueur@tcg.com",
                avatar_url: "https://example.com/avatar-custom.png",
            },
        ],
        rowCount: 1,
    })

    const { response, body } = await request("/settings/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ avatar_url: "https://example.com/avatar-custom.png" }),
    })

    assert.equal(response.status, 200)
    assert.equal(body.user.avatar_url, "https://example.com/avatar-custom.png")
})

test("PUT /settings/avatar refuse les URLs malveillantes ou XSS (javascript:, data:)", async () => {
    const { response: res1, body: body1 } = await request("/settings/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ avatar_url: "javascript:alert(1)" }),
    })
    assert.equal(res1.status, 400)
    assert.match(body1.error, /non sécurisée ou invalide/)

    const { response: res2, body: body2 } = await request("/settings/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ avatar_url: "data:text/html,<script>alert(1)</script>" }),
    })
    assert.equal(res2.status, 400)
    assert.match(body2.error, /non sécurisée ou invalide/)
})

test("PUT /settings/profile refuse un nom d'utilisateur avec injections HTML ou caractères interdits", async () => {
    const { response, body } = await request("/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ nom_utilisateur: "<script>alert(1)</script>" }),
    })
    assert.equal(response.status, 400)
    assert.match(body.error, /caractères non autorisés/)
})

test("PUT /settings/password refuse un mot de passe supérieur à 128 caractères (DoS)", async () => {
    const { response, body } = await request("/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ currentPassword: "OldPassword123!", newPassword: "A".repeat(129) }),
    })
    assert.equal(response.status, 400)
    assert.match(body.error, /ne doit pas dépasser 128 caractères/)
})

test("PUT /settings/avatar refuse les images .gif et accepte uniquement png, webp et jpeg", async () => {
    const { response: resGif, body: bodyGif } = await request("/settings/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ avatar_url: "https://example.com/avatar.gif" }),
    })
    assert.equal(resGif.status, 400)
    assert.match(bodyGif.error, /non sécurisée ou invalide/)

    const { response: resGifQuery, body: bodyGifQuery } = await request("/settings/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ avatar_url: "https://example.com/avatar.png?format=gif" }),
    })
    assert.equal(resGifQuery.status, 400)
    assert.match(bodyGifQuery.error, /non sécurisée ou invalide/)

    setQueryResult({
        rows: [
            {
                id: 7,
                nom_utilisateur: "joueur",
                email: "joueur@tcg.com",
                avatar_url: "https://example.com/avatar.webp",
            },
        ],
        rowCount: 1,
    })

    const { response: resWebp, body: bodyWebp } = await request("/settings/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ avatar_url: "https://example.com/avatar.webp" }),
    })
    assert.equal(resWebp.status, 200)
    assert.equal(bodyWebp.user.avatar_url, "https://example.com/avatar.webp")

    setQueryResult({
        rows: [
            {
                id: 7,
                nom_utilisateur: "joueur",
                email: "joueur@tcg.com",
                avatar_url: "https://example.com/avatar.jpeg",
            },
        ],
        rowCount: 1,
    })

    const { response: resJpeg, body: bodyJpeg } = await request("/settings/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders() },
        body: JSON.stringify({ avatar_url: "https://example.com/avatar.jpeg" }),
    })
    assert.equal(resJpeg.status, 200)
    assert.equal(bodyJpeg.user.avatar_url, "https://example.com/avatar.jpeg")
})


