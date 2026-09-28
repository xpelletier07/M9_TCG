import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from "express-validator"
import { checkAuth } from "../middlewares/checkAuth.js"

const router = express.Router()

const CYCLE_SECONDS = 5 * 60
const ACTIVE_WINDOW_MS = 70 * 1000
const activeUsers = new Map()
let lastProcessedCycle = null
let currentCyclePack = null

function getCycleNumber(nowMs = Date.now()) {
    return Math.floor(nowMs / 1000 / CYCLE_SECONDS)
}

function getRemainingSeconds(nowMs = Date.now()) {
    const nowSeconds = Math.floor(nowMs / 1000)
    return CYCLE_SECONDS - (nowSeconds % CYCLE_SECONDS)
}

function pruneAndGetActiveUsers(nowMs = Date.now()) {
    for (const [userId, lastSeen] of activeUsers.entries()) {
        if ((nowMs - lastSeen) > ACTIVE_WINDOW_MS) {
            activeUsers.delete(userId)
        }
    }

    return [...activeUsers.keys()]
}

async function loadRandomActivePack() {
    const result = await pool.query(
        "select id_pack, nom_pack, image_pack, description_pack from Packs where actif = true order by random() limit 1"
    )

    return result.rows[0] || null
}

async function grantPackToUsers(userIds, packId) {
    if (userIds.length === 0 || !packId) {
        return
    }

    for (const userId of userIds) {
        await pool.query(
            `insert into inventaire_packs (id_utilisateur, id_pack, quantite)
             values ($1, $2, 1)
             on conflict (id_utilisateur, id_pack)
             do update set quantite = inventaire_packs.quantite + 1`,
            [userId, packId]
        )
    }
}

async function processCycle() {
    const nowMs = Date.now()
    const cycleNumber = getCycleNumber(nowMs)

    if (lastProcessedCycle === null) {
        currentCyclePack = await loadRandomActivePack()
        lastProcessedCycle = cycleNumber
        return
    }

    if (cycleNumber === lastProcessedCycle) {
        return
    }

    const nextPack = await loadRandomActivePack()
    const activeUserIds = pruneAndGetActiveUsers(nowMs)

    if (nextPack) {
        await grantPackToUsers(activeUserIds, nextPack.id_pack)
    }

    currentCyclePack = nextPack
    lastProcessedCycle = cycleNumber
}

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `select ip.id_utilisateur, ip.id_pack, ip.quantite, p.nom_pack, p.image_pack
             from inventaire_packs ip
             join Packs p on p.id_pack = ip.id_pack
             order by ip.id_utilisateur desc`
        )
        res.json(result.rows)
    } catch (error) {
        console.error("Erreur lors de la récupération de l'inventaire des packs :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.get("/drop-state", checkAuth, async (req, res) => {
    try {
        activeUsers.set(req.user.id, Date.now())
        await processCycle()

        const remainingSeconds = getRemainingSeconds()
        const resetAt = new Date(Date.now() + remainingSeconds * 1000).toISOString()

        res.json({
            cycleSeconds: CYCLE_SECONDS,
            remainingSeconds,
            resetAt,
            pack: currentCyclePack,
        })
    } catch (error) {
        console.error("Erreur dans /inventaire-pack/drop-state", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.post("/heartbeat", checkAuth, async (req, res) => {
    try {
        activeUsers.set(req.user.id, Date.now())
        await processCycle()
        res.status(200).json({ ok: true })
    } catch (error) {
        console.error("Erreur dans /inventaire-pack/heartbeat", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.post(
    "/",
    [
        body("id_utilisateur").isInt().withMessage("L'id_utilisateur doit être un entier"),
        body("id_pack").isInt().withMessage("L'id_pack doit être un entier"),
        body("quantite").isInt({ min: 1 }).withMessage("La quantité doit être un entier positif"),
    ],
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const { id_utilisateur, id_pack, quantite } = req.body

        try {
            const result = await pool.query(
                `insert into inventaire_packs (id_utilisateur, id_pack, quantite)
                 values ($1, $2, $3)
                 on conflict (id_utilisateur, id_pack)
                 do update set quantite = inventaire_packs.quantite + excluded.quantite
                 returning *`,
                [id_utilisateur, id_pack, quantite]
            )

            res.status(201).json(result.rows[0])
        } catch (error) {
            console.error("Erreur lors de l'ajout d'un pack à l'inventaire :", error)
            res.status(500).json({ error: "Erreur serveur" })
        }
    }
)

export default router
