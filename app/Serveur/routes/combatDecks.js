import express from "express"
import { checkAuth } from "../middlewares/checkAuth.js"
import { listValidDecks } from "../game/deckService.js"
import { pool } from '../db/pool.js'

const router = express.Router()

router.use(checkAuth)

// Decks du joueur utilisables en combat (50 cartes, toutes disponibles dans l'inventaire)
router.get("/decks", async (req, res) => {
    try {
        res.json(await listValidDecks(req.user.id))
    } catch (error) {
        console.error("Erreur dans /combat/decks", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Retourne l'hitorique de combat du joueur
router.get("/history", async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                c.id_combat,
                c.date_combat,
                adversaire.nom_utilisateur AS adversaire,
                CASE
                    WHEN c.id_utilisateur1 = $1 THEN 'Victoire'
                    ELSE 'Défaite'
                END AS resultat
            FROM combats c
            JOIN utilisateurs adversaire
                ON adversaire.id = CASE
                    WHEN c.id_utilisateur1 = $1 THEN c.id_utilisateur2
                    ELSE c.id_utilisateur1
                END
            WHERE c.id_utilisateur1 = $1 OR c.id_utilisateur2 = $1
            ORDER BY c.date_combat DESC, c.id_combat DESC
            LIMIT 20
        `, [req.user.id])
        res.json(rows)
    }
    catch (error) {
        console.error("Erreur dans /combat/history", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

export default router
