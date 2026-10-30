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
const originalConnect = pool.connect.bind(pool)
// async : une erreur lancée de façon synchrone par le mock devient un rejet, comme avec pg
pool.query = async (...args) => queryMock(...args)
// Les routes qui utilisent des transactions (ex. ajout d'une carte à un deck) passent par pool.connect()
pool.connect = async () => ({
    query: async (...args) => queryMock(...args),
    release() {},
})

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
    pool.connect = originalConnect
}

// Définit la réponse des requêtes SQL : un objet fixe, ou une fonction (sql, params) => résultat
export function setQueryResult(result) {
    if (typeof result === "function") {
        queryMock = result
    } else {
        queryMock = async () => result
    }
}

// Fait échouer toutes les requêtes SQL (pour tester les réponses 500)
export function setQueryError(error = new Error("Erreur de base de données simulée")) {
    queryMock = async () => {
        throw error
    }
}

// Exécute un test en silençant console.error (les routes loguent les erreurs 500 attendues)
export async function withSilentErrors(callback) {
    const original = console.error
    console.error = () => {}
    try {
        await callback()
    } finally {
        console.error = original
    }
}

// En-têtes d'un joueur connecté (id 7). `payload` permet de surcharger le contenu du token.
export function authenticatedHeaders(payload = {}) {
    const token = jwt.sign({ id: 7, nom_utilisateur: "joueur", statut: "actif", ...payload }, process.env.JWT_SECRET)
    return { authorization: `Bearer ${token}` }
}

// En-têtes d'un administrateur (id 1)
export function adminHeaders() {
    return authenticatedHeaders({ id: 1, nom_utilisateur: "admin", statut: "admin" })
}

// Version JSON des en-têtes : ajoute content-type pour les requêtes avec un body
export function jsonHeaders(headers = {}) {
    return { ...headers, "content-type": "application/json" }
}

// Retourne la réponse JSON ; body vaut null si la réponse est vide (ex. 204)
export async function request(path, options) {
    const response = await fetch(`${baseUrl}${path}`, options)
    const text = await response.text()
    const body = text ? JSON.parse(text) : null
    return { response, body }
}

// Retourne la réponse brute sans suivre les redirections (pour tester les 302 et les en-têtes)
export async function requestRaw(path, options = {}) {
    return fetch(`${baseUrl}${path}`, { redirect: "manual", ...options })
}

export function getBaseUrl() {
    return baseUrl
}