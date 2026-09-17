import express from "express";
import cors from "cors";
//import une fonction qui permet de generer un identifiant unique pour chaque pack


const router = express.Router();



router.post("/addPacks", (req, res) => {
    const { nom_pack, image_pack, description_pack, liste_carte, valeur_pack } = req.body;

    const packs = [
        {
            id_pack: 1,
            nom_pack,
            image_pack,
            description_pack,
            liste_carte,
            valeur_pack
        }
    ];

    res.json(packs);
});

export default router;
