import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from "express-validator"
import { checkAuth, checkAdmin } from "../middlewares/checkAuth.js"

const router = express.Router()

// Retourne le solde de crédits de l'utilisateur connecté
router.get("/", checkAuth, async (req, res) => {
    try {
        const result = await pool.query("select credits from utilisateurs where id = $1", [req.user.id])

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Utilisateur introuvable" })
        }

        res.json({ credits: result.rows[0].credits })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Ajoute (montant positif) ou retire (montant négatif) des crédits à un utilisateur. Admin seulement.
// Les ventes et achats du Bazaar passeront éventuellement par la même logique.
router.post(
    "/modifier",
    checkAdmin,
    body("id_utilisateur").isInt({ min: 1 }),
    body("montant").isFloat().custom((v) => Number(v) !== 0),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const { id_utilisateur, montant } = req.body

        try {
            // La contrainte CHECK (credits >= 0) empêche le solde de devenir négatif
            const result = await pool.query(
                "update utilisateurs set credits = credits + $1 where id = $2 and credits + $1 >= 0 returning id, credits",
                [montant, id_utilisateur]
            )

            if (result.rows.length === 0) {
                const exists = await pool.query("select 1 from utilisateurs where id = $1", [id_utilisateur])
                if (exists.rows.length === 0) {
                    return res.status(404).json({ error: "Utilisateur introuvable" })
                }
                return res.status(400).json({ error: "Crédits insuffisants" })
            }

            res.json(result.rows[0])
        } catch (error) {
            console.error(error)
            res.status(500).json({ error: "Erreur serveur" })
        }
    }
)

export default router
