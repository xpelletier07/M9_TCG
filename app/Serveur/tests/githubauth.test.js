import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import jwt from "jsonwebtoken"
import {
    requestRaw,
    setQueryError,
    setQueryResult,
    startTestServer,
    stopTestServer,
    withSilentErrors,
} from "./app.test.js"

// Routes de /auth/github : connexion via OAuth GitHub (redirection puis callback)

const CLIENT_URL = "http://client.test"
const ENV_GITHUB = {
    GITHUB_CLIENT_ID: "client-id-test",
    GITHUB_CLIENT_SECRET: "client-secret-test",
    GITHUB_CALLBACK_URL: "http://localhost:3000/auth/github/callback",
    CLIENT_URL,
}
const envOriginal = {}
const fetchOriginal = globalThis.fetch
let reponseGithub

function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })
}

// Simule les appels sortants vers GitHub ; les appels vers le serveur de test passent normalement
function simulerGithub({
    token = "gh-token",
    utilisateur = { id: 4242, login: "octocat" },
    utilisateurOk = true,
    emails = [{ email: "Octo@Example.com", primary: true, verified: true }],
    emailsOk = true,
} = {}) {
    reponseGithub = async (url) => {
        if (url === "https://github.com/login/oauth/access_token") {
            return json(token ? { access_token: token } : { error: "bad_verification_code" })
        }
        if (url === "https://api.github.com/user") return json(utilisateur, utilisateurOk ? 200 : 401)
        if (url === "https://api.github.com/user/emails") return json(emails, emailsOk ? 200 : 403)
        throw new Error(`Appel inattendu vers ${url}`)
    }
}

// Simule la base de données utilisée par findOrCreateUser
function simulerBase({ parGithubId = [], parEmail = [], pseudosPris = 0, onInsert, onUpdateEmail } = {}) {
    let pseudosRefuses = 0
    setQueryResult((sql, params) => {
        if (sql.includes("where github_id = $1")) return { rows: parGithubId, rowCount: parGithubId.length }
        if (sql.includes("update utilisateurs set github_id")) {
            onUpdateEmail?.(params)
            return { rows: parEmail, rowCount: parEmail.length }
        }
        if (sql.includes("select 1 from utilisateurs where nom_utilisateur")) {
            if (pseudosRefuses < pseudosPris) {
                pseudosRefuses++
                return { rows: [{ "?column?": 1 }], rowCount: 1 }
            }
            return { rows: [], rowCount: 0 }
        }
        if (sql.includes("insert into utilisateurs")) {
            onInsert?.(params)
            return {
                rows: [{ id: 50, nom_utilisateur: params[0], email: params[1], statut: "actif" }],
                rowCount: 1,
            }
        }
        return { rows: [], rowCount: 0 }
    })
}

function callback(query, state = "etat-valide") {
    return requestRaw(`/auth/github/callback?${new URLSearchParams(query)}`, {
        headers: state ? { cookie: `gh_oauth_state=${state}` } : {},
    })
}

function location(response) {
    return response.headers.get("location")
}

before(async () => {
    for (const [cle, valeur] of Object.entries(ENV_GITHUB)) {
        envOriginal[cle] = process.env[cle]
        process.env[cle] = valeur
    }
    await startTestServer()
    globalThis.fetch = (url, options) => {
        const adresse = String(url)
        return adresse.startsWith("http://127.0.0.1") ? fetchOriginal(url, options) : reponseGithub(adresse, options)
    }
})

after(async () => {
    globalThis.fetch = fetchOriginal
    for (const [cle, valeur] of Object.entries(envOriginal)) {
        if (valeur === undefined) delete process.env[cle]
        else process.env[cle] = valeur
    }
    await stopTestServer()
})

beforeEach(() => {
    setQueryResult({ rows: [], rowCount: 0 })
    simulerGithub()
})

// -------------------------------------------------------------
// GET /auth/github (étape 1 : redirection vers GitHub)
// -------------------------------------------------------------

test("GET /auth/github redirige vers GitHub avec le client_id, le scope et un state", async () => {
    const response = await requestRaw("/auth/github")

    assert.equal(response.status, 302)
    const url = new URL(location(response))
    assert.equal(url.origin + url.pathname, "https://github.com/login/oauth/authorize")
    assert.equal(url.searchParams.get("client_id"), "client-id-test")
    assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/auth/github/callback")
    assert.equal(url.searchParams.get("scope"), "read:user user:email")
    assert.match(url.searchParams.get("state"), /^[0-9a-f]{32}$/)
})

test("GET /auth/github garde le state dans un cookie HttpOnly pour se protéger du CSRF", async () => {
    const response = await requestRaw("/auth/github")

    const state = new URL(location(response)).searchParams.get("state")
    const cookie = response.headers.getSetCookie().find((valeur) => valeur.startsWith("gh_oauth_state="))
    assert.ok(cookie.startsWith(`gh_oauth_state=${state}`))
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=Lax/i)
})

test("GET /auth/github génère un nouveau state à chaque appel", async () => {
    const premier = await requestRaw("/auth/github")
    const second = await requestRaw("/auth/github")

    assert.notEqual(
        new URL(location(premier)).searchParams.get("state"),
        new URL(location(second)).searchParams.get("state")
    )
})

test("GET /auth/github redirige vers le login avec une erreur si GitHub n'est pas configuré", async () => {
    const id = process.env.GITHUB_CLIENT_ID
    delete process.env.GITHUB_CLIENT_ID
    try {
        const response = await requestRaw("/auth/github")

        assert.equal(response.status, 302)
        assert.equal(location(response), `${CLIENT_URL}/login?error=github_non_configure`)
    } finally {
        process.env.GITHUB_CLIENT_ID = id
    }
})

// -------------------------------------------------------------
// GET /auth/github/callback (étape 2 : retour de GitHub)
// -------------------------------------------------------------

test("GET /auth/github/callback redirige avec github_refuse si l'utilisateur refuse l'autorisation", async () => {
    const response = await callback({ error: "access_denied" })

    assert.equal(response.status, 302)
    assert.equal(location(response), `${CLIENT_URL}/login?error=github_refuse`)
})

test("GET /auth/github/callback refuse une requête sans code", async () => {
    const response = await callback({ state: "etat-valide" })

    assert.equal(location(response), `${CLIENT_URL}/login?error=state_invalide`)
})

test("GET /auth/github/callback refuse une requête sans state", async () => {
    const response = await callback({ code: "code-github" })

    assert.equal(location(response), `${CLIENT_URL}/login?error=state_invalide`)
})

test("GET /auth/github/callback refuse une requête sans cookie de state", async () => {
    const response = await callback({ code: "code-github", state: "etat-valide" }, null)

    assert.equal(location(response), `${CLIENT_URL}/login?error=state_invalide`)
})

test("GET /auth/github/callback refuse un state différent de celui du cookie (CSRF)", async () => {
    const response = await callback({ code: "code-github", state: "etat-forge" }, "etat-valide")

    assert.equal(location(response), `${CLIENT_URL}/login?error=state_invalide`)
})

test("GET /auth/github/callback redirige avec echange_code_echoue si GitHub ne donne pas de token", async () => {
    simulerGithub({ token: null })

    const response = await callback({ code: "code-invalide", state: "etat-valide" })

    assert.equal(location(response), `${CLIENT_URL}/login?error=echange_code_echoue`)
})

test("GET /auth/github/callback redirige avec profil_github_indisponible si le profil est inaccessible", async () => {
    simulerGithub({ utilisateurOk: false })

    const response = await callback({ code: "code-github", state: "etat-valide" })

    assert.equal(location(response), `${CLIENT_URL}/login?error=profil_github_indisponible`)
})

test("GET /auth/github/callback crée un compte et redirige vers le client avec le JWT dans le fragment", async () => {
    let insertParams
    simulerBase({ onInsert: (params) => (insertParams = params) })

    const response = await callback({ code: "code-github", state: "etat-valide" })

    assert.equal(response.status, 302)
    const adresse = location(response)
    assert.ok(adresse.startsWith(`${CLIENT_URL}/auth/github/callback#`))
    // le token est dans le fragment (#), jamais dans la query string
    assert.ok(!adresse.includes("?token="))

    const fragment = new URLSearchParams(adresse.split("#")[1])
    const payload = jwt.verify(fragment.get("token"), process.env.JWT_SECRET)
    assert.equal(payload.id, 50)
    assert.equal(payload.nom_utilisateur, "octocat")
    assert.equal(payload.statut, "actif")
    assert.equal(payload.exp - payload.iat, 2 * 60 * 60)
    assert.deepEqual(JSON.parse(fragment.get("user")), {
        id: 50,
        nom_utilisateur: "octocat",
        email: "octo@example.com",
    })
    assert.deepEqual(insertParams, ["octocat", "octo@example.com", "4242"])
})

test("GET /auth/github/callback supprime le cookie de state après une connexion réussie", async () => {
    simulerBase()

    const response = await callback({ code: "code-github", state: "etat-valide" })

    const cookie = response.headers.getSetCookie().find((valeur) => valeur.startsWith("gh_oauth_state="))
    assert.ok(cookie.startsWith("gh_oauth_state=;"))
})

test("GET /auth/github/callback reconnecte un compte déjà lié à ce github_id sans rien créer", async () => {
    let insertions = 0
    simulerBase({
        parGithubId: [{ id: 12, nom_utilisateur: "octocat", email: "octo@example.com", statut: "actif" }],
        onInsert: () => insertions++,
    })

    const response = await callback({ code: "code-github", state: "etat-valide" })

    const fragment = new URLSearchParams(location(response).split("#")[1])
    assert.equal(jwt.verify(fragment.get("token"), process.env.JWT_SECRET).id, 12)
    assert.equal(insertions, 0)
})

test("GET /auth/github/callback lie le compte existant dont l'email est vérifié par GitHub", async () => {
    let paramsLiaison
    let insertions = 0
    simulerBase({
        parEmail: [{ id: 30, nom_utilisateur: "joueur", email: "octo@example.com", statut: "admin" }],
        onUpdateEmail: (params) => (paramsLiaison = params),
        onInsert: () => insertions++,
    })

    const response = await callback({ code: "code-github", state: "etat-valide" })

    const fragment = new URLSearchParams(location(response).split("#")[1])
    const payload = jwt.verify(fragment.get("token"), process.env.JWT_SECRET)
    assert.equal(payload.id, 30)
    assert.equal(payload.statut, "admin")
    // l'email est comparé en minuscules
    assert.deepEqual(paramsLiaison, ["4242", "octo@example.com"])
    assert.equal(insertions, 0)
})

test("GET /auth/github/callback ne lie jamais un compte par email si GitHub n'expose aucun email vérifié", async () => {
    let tentativesLiaison = 0
    let insertParams
    simulerGithub({ emails: [{ email: "non-verifie@example.com", primary: true, verified: false }] })
    simulerBase({
        parEmail: [{ id: 30, nom_utilisateur: "victime", email: "non-verifie@example.com", statut: "actif" }],
        onUpdateEmail: () => tentativesLiaison++,
        onInsert: (params) => (insertParams = params),
    })

    await callback({ code: "code-github", state: "etat-valide" })

    assert.equal(tentativesLiaison, 0)
    assert.equal(insertParams[1], "4242+octocat@users.noreply.github.com")
})

test("GET /auth/github/callback utilise l'adresse noreply de GitHub si la liste des emails est inaccessible", async () => {
    let insertParams
    simulerGithub({ emailsOk: false })
    simulerBase({ onInsert: (params) => (insertParams = params) })

    const response = await callback({ code: "code-github", state: "etat-valide" })

    assert.equal(response.status, 302)
    assert.ok(location(response).startsWith(`${CLIENT_URL}/auth/github/callback#`))
    assert.equal(insertParams[1], "4242+octocat@users.noreply.github.com")
})

test("GET /auth/github/callback préfère l'email principal vérifié, sinon n'importe quel email vérifié", async () => {
    const emailsUtilises = []
    simulerGithub({
        emails: [
            { email: "secondaire@example.com", primary: false, verified: true },
            { email: "principal@example.com", primary: true, verified: true },
        ],
    })
    simulerBase({ onUpdateEmail: (params) => emailsUtilises.push(params[1]) })
    await callback({ code: "code-github", state: "etat-valide" })

    simulerGithub({
        emails: [
            { email: "principal-non-verifie@example.com", primary: true, verified: false },
            { email: "secondaire@example.com", primary: false, verified: true },
        ],
    })
    simulerBase({ onUpdateEmail: (params) => emailsUtilises.push(params[1]) })
    await callback({ code: "code-github", state: "etat-valide" })

    assert.deepEqual(emailsUtilises, ["principal@example.com", "secondaire@example.com"])
})

test("GET /auth/github/callback ajoute un suffixe si le nom d'utilisateur est déjà pris", async () => {
    let insertParams
    simulerBase({ pseudosPris: 1, onInsert: (params) => (insertParams = params) })

    await callback({ code: "code-github", state: "etat-valide" })

    assert.match(insertParams[0], /^octocat-\d{4}$/)
})

test("GET /auth/github/callback tronque le login GitHub à 40 caractères", async () => {
    let insertParams
    simulerGithub({ utilisateur: { id: 4242, login: "a".repeat(60) } })
    simulerBase({ onInsert: (params) => (insertParams = params) })

    await callback({ code: "code-github", state: "etat-valide" })

    assert.equal(insertParams[0], "a".repeat(40))
})

test("GET /auth/github/callback redirige avec erreur_serveur sur erreur de base de données", async () => {
    await withSilentErrors(async () => {
        setQueryError()

        const response = await callback({ code: "code-github", state: "etat-valide" })

        assert.equal(response.status, 302)
        assert.equal(location(response), `${CLIENT_URL}/login?error=erreur_serveur`)
    })
})