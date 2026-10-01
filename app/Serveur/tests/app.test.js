import express from "express"
import jwt from "jsonwebtoken"
import { pool } from "../db/pool.js"
import apiRouter from "../Router/Router_Global.js"

process.env.JWT_SECRET ||= "test-secret"

export const app = express()
let server
let baseUrl
let queryMock = async () => ({ rows: [], rowCount: 0, ok: true })
const originalQuery = pool.query.bind(pool)
pool.query = (...args) => queryMock(...args)

app.use(express.json())


//Appel du Router Global pour gérer les routes de l'API
app.use(apiRouter)



app.get("/", (req, res) => {
    res.json({ message: "M9 TCG API en ligne" })
})

app.get("/health", (req, res) => {
    res.json({ status: "ok" })
})

export async function startTestServer() {
    server = app.listen(0)
    await new Promise((resolve) => server.once("listening", resolve))
    const { port } = server.address()
    baseUrl = `http://127.0.0.1:${port}`
}

export async function stopTestServer() {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    pool.query = originalQuery
}

export function setQueryResult(result) {
    if (typeof result === "function") {
        queryMock = result
    } else {
        queryMock = async () => result
    }
}

export function authenticatedHeaders() {
    const token = jwt.sign({ id: 7, nom_utilisateur: "joueur" }, process.env.JWT_SECRET)
    return { authorization: `Bearer ${token}` }
}

export async function request(path, options) {
    const response = await fetch(`${baseUrl}${path}`, options)
    const body = await response.json()
    return { response, body }
}
