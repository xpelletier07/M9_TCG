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

// -------------------------------------------------------------
// ROUTES D'INVENTAIRE EXISTANTES
// -------------------------------------------------------------

// Ouvrir un pack possédé et en retirer un exemplaire de l'inventaire
router.post("/:idPack/open", checkAuth, async (req, res) => {
    const idPack = Number(req.params.idPack)

    if (!Number.isInteger(idPack) || idPack < 1) {
        return res.status(400).json({ error: "Identifiant de pack invalide" })
    }

    const client = await pool.connect()
    try {
        await client.query("begin")

        const result = await client.query(
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

        if (result.rows.length === 0) {
            await client.query("rollback")
            return res.status(404).json({ error: "Ce pack n'est pas dans votre inventaire" })
        }

        const packOuvert = result.rows[0]

        if (packOuvert.quantite === 0) {
            await client.query(
                `delete from inventaire_packs
                 where id_utilisateur = $1 and id_pack = $2 and quantite = 0`,
                [req.user.id, idPack]
            )
        }

        await client.query("commit")
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
        await client.query("rollback")
        console.error("Erreur lors de l'ouverture du pack :", error)
        res.status(500).json({ error: "Erreur serveur" })
    } finally {
        client.release()
    }
})

// ajouter un pack a son propre compte
router.post("/:idPack", checkAuth, async (req, res) => {
    // Prends l'id donné en params, le mets en int
    const idPack = Number(req.params.idPack);
    try {
        const result = await pool.query(
            // crée une entrée dans la table, si déjà une entrée, update l'entrée et ajoute un à la quantité
            `INSERT INTO inventaire_packs (id_utilisateur, id_pack, quantite)                                                                                  
                VALUES ($1, $2, 1)                                                                                                                                
                ON CONFLICT (id_utilisateur, id_pack)                                                                                                             
                DO UPDATE SET quantite = inventaire_packs.quantite + 1; returning *`,
            [req.user.id, idPack]
        )
        res.status(200).json(result)
    } catch (error) {
        console.error("Erreur lors de l'ajout d'un pack à l'inventaire :", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
}
)

// GET pour obtenir les packs du joueur connecté
router.get("/me", checkAuth, async (req, res) => {
    try {
        // join les deux tables pour obtenir tous les packs de l'utilisateur et la quantité de chaque
        const resultat = await pool.query(`
            select p.*, ip.quantite from inventaire_packs as ip 
            join Packs as p on p.id_pack = ip.id_pack
            where ip.id_utilisateur = $1`,
            [req.user.id]
        )
        res.status(200).json(resultat.rows)
    } catch (error) {
        console.error("Erreur dans ", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

export default router
