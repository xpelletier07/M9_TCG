import { pool } from "./../db/pool.js"
import express from "express"

const router = express.Router()


router.get("/all", async (req, res) => {
    try {
        const result = await pool.query("select * from packs order by id_pack desc")
        res.status(200).json(result.rows)
    } catch (error) {
        console.error("Erreur dans /pack/all", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})



router.post("/addPacks", (req, res) => {
    const { nom_pack, image_pack, description_pack, liste_carte, valeur_pack } = req.body;

    try {
        const query = `INSERT INTO packs (nom_pack, image_pack, description_pack, liste_carte, valeur_pack)
                       VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    }
    catch (error) {
        console.error("Erreur dans /pack/addPacks", error);
        res.status(500).json({ error: "Erreur serveur" });

    }
})



router.delete("/delete/:id", async (req, res) => {
    const { id } = req.params

    try {
        const result = await pool.query("DELETE FROM packs WHERE id_pack = $1 RETURNING *", [id])
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