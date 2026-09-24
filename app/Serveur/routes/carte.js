import { pool } from "./../db/pool.js"
import express from "express"

const router = express.Router()

// Route pour get la carte, d'apres l'id
router.get("/api/carte/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const result = await pool.query("SELECT * FROM carte WHERE id_carte = $1", [id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Erreur lors de la récupération de la carte :", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
})