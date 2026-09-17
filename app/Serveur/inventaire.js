import express from "express";

const app = express();


// Route pour get l'inventaire de cartes d'un utilisateur
app.get("/api/inventaire/:id_user", async (req, res) => {
    try {
        const id_user = req.params.id_user;
        const result = await pool.query("SELECT * FROM inventaire_carte WHERE id_user = $1", [id_user]);
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur lors de la récupération de l'inventaire :", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
})