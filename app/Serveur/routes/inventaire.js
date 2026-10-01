import { pool } from "./../db/pool.js"
import express from "express"

const router = express.Router()


// Route pour get l'inventaire de cartes d'un utilisateur
router.get("/inventaire/:id_user", async (req, res) => {
    try {
        const id_user = req.params.id_user;
        const result = await pool.query("SELECT * FROM inventaire_carte WHERE id_utilisateur = $1", [id_user]);
        if (result.rows.length === 0) {
            return res.status(200).json({ message: "Aucune carte dans l'inventaire", cartes: [] });
        }
        res.status(200).json({ cartes: result.rows });
    } catch (err) {
        console.error("Erreur lors de la récupération de l'inventaire :", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
})

// Route pour ajouter une carte à l'inventaire d'un utilisateur
// Si la carte existe déjà, on incrémente la quantité au lieu d'échouer
router.post("/carteInventaire/:id_user/:id_carte", async (req, res) => {
    try {
        const id_user = req.params.id_user;
        const id_carte = req.params.id_carte;
        const result = await pool.query(
            `INSERT INTO inventaire_carte (id_utilisateur, id_carte, quantite)
             VALUES ($1, $2, 1)
             ON CONFLICT (id_utilisateur, id_carte)
             DO UPDATE SET quantite = inventaire_carte.quantite + 1
             RETURNING *`,
            [id_user, id_carte]
        );
        res.status(201).json({ message: "Carte ajoutée à l'inventaire", newCard: result.rows[0] });
    } catch (err) {
        console.error("Erreur lors de l'ajout de la carte à l'inventaire :", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
})

// Route pour supprimer une carte de l'inventaire d'un utilisateur
router.delete("/carteInventaire/:id_user/:id_carte", async (req, res) => {
    try {
        const id_user = req.params.id_user;
        const id_carte = req.params.id_carte;
        const result = await pool.query("DELETE FROM inventaire_carte WHERE id_utilisateur = $1 AND id_carte = $2 RETURNING *", [id_user, id_carte]);
        if (result.rowCount === 0) {
            res.status(404).json({ message: "Carte non trouvée dans l'inventaire" });
        } else {
            res.json({ message: "Carte supprimée de l'inventaire", deletedCard: result.rows[0] });
        }
    } catch (err) {
        console.error("Erreur lors de la suppression de la carte de l'inventaire :", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

export default router;