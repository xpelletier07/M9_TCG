import { pool } from "./../db/pool.js"
import express from "express"

const router = express.Router()

// GET pour obtenir toutes les cartes
router.get("/all", async (req, res) => {
    try {
        const result = await pool.query("select * from carte order by id_carte desc")
        res.status(200).json(result)
    } catch (error) {
        console.error("Erreur dans /collection/all", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.post("/add", async (req, res) => {
    try{
        const { nomCarte, image, description, rarete, valeur, mana, health, damage} = req.body
    } catch (error) {
        console.error("Erreur dans /collection/add", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})