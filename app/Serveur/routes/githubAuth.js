import crypto from "node:crypto"
import express from "express"
import jwt from "jsonwebtoken"
import { pool } from "../db/pool.js"

const router = express.Router()

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
const GITHUB_API_URL = "https://api.github.com"
const STATE_COOKIE = "gh_oauth_state"

function config() {
    return {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackUrl: process.env.GITHUB_CALLBACK_URL || "http://localhost:3000/auth/github/callback",
        clientUrl: process.env.CLIENT_URL || "http://localhost:5173"
    }
}

// Redirige vers la page de login du client avec un code d'erreur lisible
function redirectWithError(res, code) {
    res.clearCookie(STATE_COOKIE)
    res.redirect(`${config().clientUrl}/login?error=${encodeURIComponent(code)}`)
}

// Lit un cookie dans le header brut (évite d'ajouter cookie-parser pour un seul cookie)
function readCookie(req, name) {
    const header = req.headers.cookie || ""
    for (const part of header.split(";")) {
        const [key, ...rest] = part.trim().split("=")
        if (key === name) return decodeURIComponent(rest.join("="))
    }
    return null
}

function githubHeaders(accessToken) {
    return {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "M9-TCG"
    }
}

// Trouve un nom d'utilisateur libre à partir du login GitHub (nom_utilisateur est UNIQUE, 50 car. max)
async function findAvailableUsername(login) {
    const base = login.slice(0, 40)
    let candidate = base
    for (let i = 0; i < 20; i++) {
        const taken = await pool.query("select 1 from utilisateurs where nom_utilisateur = $1", [candidate])
        if (taken.rows.length === 0) return candidate
        candidate = `${base}-${crypto.randomInt(1000, 10000)}`
    }
    return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

// Retrouve ou crée l'utilisateur local correspondant au compte GitHub
async function findOrCreateUser(githubUser, verifiedEmail) {
    const githubId = String(githubUser.id)

    const byGithubId = await pool.query(
        "select id, nom_utilisateur, email, statut from utilisateurs where github_id = $1",
        [githubId]
    )
    if (byGithubId.rows[0]) return byGithubId.rows[0]

    // Un email vérifié par GitHub correspondant à un compte existant -> on lie les deux comptes
    if (verifiedEmail) {
        const byEmail = await pool.query(
            "update utilisateurs set github_id = $1 where lower(email) = $2 and github_id is null returning id, nom_utilisateur, email, statut",
            [githubId, verifiedEmail]
        )
        if (byEmail.rows[0]) return byEmail.rows[0]
    }

    const nomUtilisateur = await findAvailableUsername(githubUser.login)
    // GitHub n'expose pas toujours l'email : on utilise l'adresse noreply de GitHub en dernier recours
    const email = verifiedEmail || `${githubId}+${githubUser.login}@users.noreply.github.com`

    const created = await pool.query(
        "insert into utilisateurs (nom_utilisateur, email, github_id) values ($1, $2, $3) returning id, nom_utilisateur, email, statut",
        [nomUtilisateur, email, githubId]
    )
    return created.rows[0]
}

// Étape 1 : redirige l'utilisateur vers GitHub pour qu'il autorise l'application
router.get("/", (req, res) => {
    const { clientId, callbackUrl } = config()

    if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
        return redirectWithError(res, "github_non_configure")
    }

    // Le state protège contre le CSRF : on le garde dans un cookie et on le compare au retour de GitHub
    const state = crypto.randomBytes(16).toString("hex")
    res.cookie(STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 10 * 60 * 1000,
        secure: process.env.NODE_ENV === "production"
    })

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: "read:user user:email",
        state
    })
    res.redirect(`${GITHUB_AUTHORIZE_URL}?${params}`)
})

// Étape 2 : GitHub rappelle cette route avec un `code` qu'on échange contre un access token
router.get("/callback", async (req, res) => {
    const { code, state, error } = req.query
    const { clientId, clientSecret, callbackUrl, clientUrl } = config()

    if (error) return redirectWithError(res, "github_refuse")

    const expectedState = readCookie(req, STATE_COOKIE)
    if (!code || !state || !expectedState || state !== expectedState) {
        return redirectWithError(res, "state_invalide")
    }

    try {
        const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: callbackUrl
            })
        })
        const tokenData = await tokenResponse.json()

        if (!tokenData.access_token) {
            return redirectWithError(res, "echange_code_echoue")
        }

        const userResponse = await fetch(`${GITHUB_API_URL}/user`, { headers: githubHeaders(tokenData.access_token) })
        if (!userResponse.ok) return redirectWithError(res, "profil_github_indisponible")
        const githubUser = await userResponse.json()

        // /user/emails retourne aussi les emails privés ; on ne garde que le principal vérifié
        let verifiedEmail = null
        const emailsResponse = await fetch(`${GITHUB_API_URL}/user/emails`, { headers: githubHeaders(tokenData.access_token) })
        if (emailsResponse.ok) {
            const emails = await emailsResponse.json()
            const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified)
            verifiedEmail = primary ? primary.email.toLowerCase() : null
        }

        const user = await findOrCreateUser(githubUser, verifiedEmail)

        // Même JWT que pour le login classique (voir routes/auth.js)
        const token = jwt.sign(
            { id: user.id, nom_utilisateur: user.nom_utilisateur, statut: user.statut },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        )

        // Le token est placé dans le fragment (#) pour ne jamais apparaître dans les logs serveur
        const payload = new URLSearchParams({
            token,
            user: JSON.stringify({ id: user.id, nom_utilisateur: user.nom_utilisateur, email: user.email })
        })
        res.clearCookie(STATE_COOKIE)
        res.redirect(`${clientUrl}/auth/github/callback#${payload}`)
    } catch (err) {
        console.error("Erreur dans /auth/github/callback", err)
        redirectWithError(res, "erreur_serveur")
    }
})

export default router
