import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from "express-validator"
import jwt from "jsonwebtoken"
import { checkAuth } from "../middlewares/checkAuth.js"
import { getDropCommunState } from "../services/dropCommunService.js"

const router = express.Router()

// Cycle de drop de cartes global (5 minutes)
const CYCLE_SECONDS = 5 * 60
// Cooldown pour réclamer un pack (24 heures)
const PACK_COOLDOWN_HOURS = 24
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
        "select id_pack, nom_pack, image_pack, description_pack, liste_carte from Packs order by random() limit 1"
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
        let userId = null
        const authHeader = req.headers.authorization
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1]
                const decoded = jwt.decode(token)
                if (decoded?.id) userId = decoded.id
            } catch {
                // ignore invalid token in public route
            }
        }
        const dropState = await getDropCommunState(userId)

        if (!currentCyclePack) {
            currentCyclePack = await loadRandomActivePack()
        }

        res.json({
            cycleSeconds: CYCLE_SECONDS,
            remainingSeconds: dropState.remainingSeconds,
            resetAt: dropState.resetAt || new Date().toISOString(),
            isClaimReady: dropState.isClaimReady,
            canClaim: dropState.canClaim,
            claimedCount: dropState.claimedCount,
            expectedClaimCount: dropState.expectedClaimCount,
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

// -------------------------------------------------------------
// ROUTES D'INVENTAIRE EXISTANTES
// -------------------------------------------------------------

// Ouvrir un pack possédé et en retirer un exemplaire de l'inventaire
router.post("/:idPack/open", checkAuth, async (req, res) => {
    const idPack = Number(req.params.idPack)

    try {
        if (!Number.isInteger(idPack) || idPack < 1) {
            return res.status(400).json({ error: "Identifiant de pack invalide" })
        }

        const checkIfInInventory = await pool.query(
            `select quantite from inventaire_packs where id_utilisateur = $1 and id_pack = $2`,
            [req.user.id, idPack]
        )
        if (checkIfInInventory.rows.length === 0) {
            return res.status(404).json({ error: "Ce pack n'est pas dans votre inventaire" })
        }

        const result = await pool.query(
            `update inventaire_packs ip
             set quantite = ip.quantite - 1
             from Packs p
             where ip.id_utilisateur = $1
               and ip.id_pack = $2
               and ip.quantite > 0
               and p.id_pack = ip.id_pack
             returning p.id_pack, p.nom_pack, p.image_pack, p.description_pack,
                       p.liste_carte, ip.quantite`,
            [req.user.id, idPack]
        )
        const packOuvert = result.rows[0]
        // si c'était le dernier pack, on supprime l'entrée
        if (packOuvert.quantite === 0) {
            await pool.query(
                `delete from inventaire_packs
                 where id_utilisateur = $1 and id_pack = $2 and quantite = 0`,
                [req.user.id, idPack]
            )
        }

        res.status(200).json({
            pack: {
                id_pack: packOuvert.id_pack,
                nom_pack: packOuvert.nom_pack,
                image_pack: packOuvert.image_pack,
                description_pack: packOuvert.description_pack,
                liste_carte: packOuvert.liste_carte,
            },
            quantite: packOuvert.quantite,
        })
    } catch (error) {
        console.error("Erreur lors de l'ouverture du pack :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Fonction commune pour claim un pack (cooldown 24h)
async function claimPackHandler(req, res, idPackParam) {
    let idPack = idPackParam
    if (!idPack) {
        const bodyId = req.body?.id_pack
        if (bodyId) idPack = Number(bodyId)
    }

    if (!idPack || !Number.isInteger(idPack) || idPack < 1) {
        const firstPack = await pool.query("select id_pack from Packs order by id_pack asc limit 1")
        if (firstPack.rows.length === 0) {
            return res.status(404).json({ error: "Aucun pack disponible" })
        }
        idPack = firstPack.rows[0].id_pack
    }

    try {
        const packQuery = await pool.query(
            "select id_pack, nom_pack, image_pack, description_pack, liste_carte from Packs where id_pack = $1",
            [idPack]
        )
        if (packQuery.rows.length === 0) {
            return res.status(404).json({ error: "Pack introuvable ou inactif" })
        }

        // Mise à jour conditionnelle : ne réussit que si le cooldown de 24h est écoulé
        const updateResult = await pool.query(
            `update utilisateurs
             set dernier_drop_pack_at = now()
             where id = $1
               and (
                   dernier_drop_pack_at is null
                   or dernier_drop_pack_at <= now() - interval '${PACK_COOLDOWN_HOURS} hours'
               )
             returning dernier_drop_pack_at`,
            [req.user.id]
        )

        if (updateResult.rows.length === 0) {
            const userResult = await pool.query(
                "select dernier_drop_pack_at from utilisateurs where id = $1",
                [req.user.id]
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

        // Ajout du pack à l'inventaire
        const invResult = await pool.query(
            `insert into inventaire_packs (id_utilisateur, id_pack, quantite)
             values ($1, $2, 1)
             on conflict (id_utilisateur, id_pack)
             do update set quantite = inventaire_packs.quantite + 1
             returning id_pack, quantite`,
            [req.user.id, idPack]
        )

        const cooldownRemainingSeconds = PACK_COOLDOWN_HOURS * 60 * 60
        res.status(200).json({
            message: "Pack réclamé avec succès !",
            pack: packQuery.rows[0],
            quantite: invResult.rows[0]?.quantite ?? 1,
            cooldownRemainingSeconds,
            cooldownResetAt: new Date(Date.now() + cooldownRemainingSeconds * 1000).toISOString(),
        })
    } catch (error) {
        console.error("Erreur lors de l'ajout d'un pack à l'inventaire :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
}

// Support des deux routes : /claim et /open
router.post("/claim", checkAuth, (req, res) => claimPackHandler(req, res))
router.post("/open", checkAuth, (req, res) => claimPackHandler(req, res))

// Réclamer un pack via /:idPack
router.post("/:idPack", checkAuth, async (req, res) => {
    const idPack = Number(req.params.idPack)
    if (!Number.isInteger(idPack) || idPack < 1) {
        return res.status(400).json({ error: "Identifiant de pack invalide" })
    }
    return claimPackHandler(req, res, idPack)
})

// GET pour obtenir les packs du joueur connecté
router.get("/me", checkAuth, async (req, res) => {
    try {
        const resultat = await pool.query(`
            select p.*, ip.quantite from inventaire_packs as ip 
            join Packs as p on p.id_pack = ip.id_pack
            where ip.id_utilisateur = $1`,
            [req.user.id]
        )
        res.status(200).json(resultat.rows)
    } catch (error) {
        console.error("Erreur dans /inventaire-pack/me", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

export default router
