import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import express from "express"
import authRouter from "../routes/auth.js"
import collectionRouter from "../routes/collection.js"
import inventoryRouter from "../routes/inventory.js"

const app = express()
let server
let baseUrl

app.use(express.json())
app.use("/collection", collectionRouter)
app.use("/inventory", inventoryRouter)
app.use("/auth", authRouter)

app.get("/", (req, res) => {
    res.json({ message: "M9 TCG API en ligne" })
})

app.get("/health", (req, res) => {
    res.json({ status: "ok" })
})

before(async () => {
    server = app.listen(0)
    await new Promise((resolve) => server.once("listening", resolve))
    const { port } = server.address()
    baseUrl = `http://127.0.0.1:${port}`
})

after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

async function request(path, options) {
    const response = await fetch(`${baseUrl}${path}`, options)
    const body = await response.json()
    return { response, body }
}

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

test("GET /inventory/cards exige une authentification", async () => {
    const { response, body } = await request("/inventory/cards")

    assert.equal(response.status, 401)
    assert.equal(body.error, "Authentification requise")
})

test("POST /collection/newCard valide les champs obligatoires", async () => {
    const { response, body } = await request("/collection/newCard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
    })

    assert.equal(response.status, 400)
    assert.ok(Array.isArray(body.erreurs))
    assert.ok(body.erreurs.some((error) => error.path === "nomCarte"))
})