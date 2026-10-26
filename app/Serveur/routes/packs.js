import { pool } from "./../db/pool.js"
import express from "express"
import { checkAuth, checkAdmin } from "../middlewares/checkAuth.js"

const router = express.Router()

// GET pour obtenir tous les packs
router.get("/", checkAuth, async (req, res) => {
    try {
        const result = await pool.query("select * from Packs order by id_pack desc")
        res.status(200).json(result.rows)
    } catch (error) {
        console.error("Erreur dans /pack/all", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// POST pour ajouter un nouveau pack
router.post("/", checkAdmin, async (req, res) => {
    const { nom_pack, image_pack, description_pack, liste_carte, valeur_pack, actif } = req.body

    if (!nom_pack || !image_pack || !description_pack || !Array.isArray(liste_carte) || valeur_pack === undefined || actif === undefined) {
        return res.status(400).json({ error: "Données manquantes ou invalides" })
    }

    try {
        const result = await pool.query(
            `INSERT INTO Packs (nom_pack, image_pack, description_pack, liste_carte, valeur_pack, actif)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [nom_pack, image_pack, description_pack, liste_carte, valeur_pack, actif]
        )

        res.status(201).json(result.rows[0])
    } catch (error) {
        console.error("Erreur dans /pack/addPacks", error)

        if (error?.code === "23505") {
            return res.status(409).json({ error: `Le pack "${nom_pack}" existe déjà.` })
        }

        res.status(500).json({ error: "Erreur serveur" })
    }
})

// PUT pour modifier un pack existant
router.put("/:id", checkAdmin, async (req, res) => {
    const { id } = req.params
    const { nom_pack, image_pack, description_pack, liste_carte, valeur_pack, actif } = req.body

    try {
        const result = await pool.query("UPDATE Packs SET nom_pack = $1, image_pack = $2, description_pack = $3, liste_carte = $4, valeur_pack = $5, actif = $6 WHERE id_pack = $7 RETURNING *", [nom_pack, image_pack, description_pack, liste_carte, valeur_pack, actif, id])
        if (result.rows.length === 0) {
            res.status(404).json({ error: "Pack non trouvé" })
        } else {
            res.status(200).json(result.rows[0])
        }
    } catch (error) {
        console.error("Erreur dans /pack/update", error)

        if (error?.code === "23505") {
            return res.status(409).json({ error: `Le pack "${nom_pack}" existe déjà.` })
        }

        res.status(500).json({ error: "Erreur serveur" })
    }
})

// DELETE pour supprimer un pack avec l'id
router.delete("/:id", checkAdmin, async (req, res) => {
    const { id } = req.params

    try {
        const result = await pool.query("DELETE FROM Packs WHERE id_pack = $1 RETURNING *", [id])
        if (result.rows.length === 0) {
            res.status(404).json({ error: "Pack non trouvé" })
        } else {
            res.status(200).json(result.rows[0])
        }
    } catch (error) {
        console.error("Erreur dans /pack/delete", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

export default router