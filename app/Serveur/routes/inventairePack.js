import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from "express-validator"
import { checkAuth } from "../middlewares/checkAuth.js"

const router = express.Router()

// Cycle de drop de cartes global (5 minutes)
const CYCLE_SECONDS = 5 * 60
// Cooldown pour réclamer un pack (24 heures)
const PACK_COOLDOWN_HOURS = 24 //
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

async function loadRandomActivePack() {
    const result = await pool.query(
        "select id_pack, nom_pack, image_pack, description_pack, liste_carte from Packs where actif = true order by random() limit 1"
    )

    return result.rows[0] || null
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

    currentCyclePack = await loadRandomActivePack()
    lastProcessedCycle = cycleNumber
}

// -------------------------------------------------------------
// ROUTES GLOBALES DE DROP (5 min - Carte drop global)
// -------------------------------------------------------------

router.get("/drop-state", async (req, res) => {
    try {
        await processCycle()

        const nowMs = Date.now()
        const remainingSeconds = getRemainingSeconds(nowMs)
        const resetAt = new Date(nowMs + remainingSeconds * 1000).toISOString()

        if (!currentCyclePack) {
            currentCyclePack = await loadRandomActivePack()
        }

        res.json({
            cycleSeconds: CYCLE_SECONDS,
            remainingSeconds,
            resetAt,
            pack: currentCyclePack,
        })
    } catch (error) {
        console.error("Erreur dans /inventaire-pack/drop-state :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.post("/heartbeat", checkAuth, async (req, res) => {
    try {
        activeUsers.set(req.user.id, Date.now())
        await processCycle()
        res.status(200).json({ ok: true })
    } catch (error) {
        console.error("Erreur dans /inventaire-pack/heartbeat :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// -------------------------------------------------------------
// ROUTES PERSONNELLES POUR LES PACKS (Cooldown 24h - Get Pack)
// -------------------------------------------------------------

// Vérifier l'état du cooldown de pack pour l'utilisateur connecté
router.get("/status", checkAuth, async (req, res) => {
    try {
        const userId = req.user.id
        const userResult = await pool.query(
            "select dernier_drop_pack_at from utilisateurs where id = $1",
            [userId]
        )
        const lastDropAt = userResult.rows[0]?.dernier_drop_pack_at
        const nowMs = Date.now()
        const cooldownResetMs = lastDropAt
            ? new Date(lastDropAt).getTime() + PACK_COOLDOWN_HOURS * 60 * 60 * 1000
            : nowMs
        const cooldownRemainingSeconds = Math.max(
            0,
            Math.ceil((cooldownResetMs - nowMs) / 1000)
        )
        const canClaim = cooldownRemainingSeconds === 0
        const cooldownResetAt = lastDropAt
            ? new Date(cooldownResetMs).toISOString()
            : null

        const invResult = await pool.query(
            "select id_pack, quantite from inventaire_packs where id_utilisateur = $1",
            [userId]
        )

        res.json({
            canClaim,
            cooldownRemainingSeconds,
            cooldownResetAt,
            inventory: invResult.rows || [],
        })
    } catch (error) {
        console.error("Erreur dans /inventaire-pack/status :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Réclamer / Ouvrir un pack (1 fois toutes les 24h)
async function handleOpenPack(req, res) {
    try {
        const userId = req.user.id
        let { id_pack } = req.body || {}

        // Si id_pack n'est pas spécifié, on sélectionne le premier pack actif
        if (!id_pack) {
            const packResult = await pool.query(
                "select id_pack from Packs where actif = true order by id_pack asc limit 1"
            )
            if (packResult.rows.length === 0) {
                return res.status(404).json({ error: "Aucun pack actif disponible" })
            }
            id_pack = packResult.rows[0].id_pack
        }

        const packQuery = await pool.query(
            "select id_pack, nom_pack, image_pack, description_pack, liste_carte from Packs where id_pack = $1 and actif = true",
            [id_pack]
        )
        if (packQuery.rows.length === 0) {
            return res.status(404).json({ error: "Pack introuvable ou inactif" })
        }
        const pack = packQuery.rows[0]

        // Mise à jour conditionnelle avec verrouillage du cooldown de 24 heures
        const updateResult = await pool.query(
            `update utilisateurs
             set dernier_drop_pack_at = now()
             where id = $1
               and (
                   dernier_drop_pack_at is null
                   or dernier_drop_pack_at <= now() - interval '${PACK_COOLDOWN_HOURS} hours'
               )
             returning dernier_drop_pack_at`,
            [userId]
        )

        if (updateResult.rows.length === 0) {
            const userResult = await pool.query(
                "select dernier_drop_pack_at from utilisateurs where id = $1",
                [userId]
            )
            const lastDropAt = userResult.rows[0]?.dernier_drop_pack_at
            const nowMs = Date.now()
            const cooldownResetMs = lastDropAt
                ? new Date(lastDropAt).getTime() + PACK_COOLDOWN_HOURS * 60 * 60 * 1000
                : nowMs + PACK_COOLDOWN_HOURS * 60 * 60 * 1000
            const cooldownRemainingSeconds = Math.max(
                0,
                Math.ceil((cooldownResetMs - nowMs) / 1000)
            )

            return res.status(429).json({
                error: "Vous devez attendre 24h entre chaque pack.",
                cooldownRemainingSeconds,
                cooldownResetAt: new Date(cooldownResetMs).toISOString(),
            })
        }

        // Ajout du pack à l'inventaire de l'utilisateur
        const invResult = await pool.query(
            `insert into inventaire_packs (id_utilisateur, id_pack, quantite)
             values ($1, $2, 1)
             on conflict (id_utilisateur, id_pack)
             do update set quantite = inventaire_packs.quantite + 1
             returning id_pack, quantite`,
            [userId, id_pack]
        )

        const nowMs = Date.now()
        const cooldownRemainingSeconds = PACK_COOLDOWN_HOURS * 60 * 60
        const cooldownResetAt = new Date(nowMs + cooldownRemainingSeconds * 1000).toISOString()

        res.status(200).json({
            message: "Pack réclamé avec succès !",
            pack,
            quantite: invResult.rows[0]?.quantite ?? 1,
            cooldownRemainingSeconds,
            cooldownResetAt,
        })
    } catch (error) {
        console.error("Erreur dans l'ouverture du pack :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
}

router.post("/open", checkAuth, handleOpenPack)
router.post("/claim", checkAuth, handleOpenPack)

// -------------------------------------------------------------
// ROUTES D'INVENTAIRE EXISTANTES
// -------------------------------------------------------------

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
