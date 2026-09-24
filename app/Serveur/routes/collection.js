import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from 'express-validator'
const router = express.Router()

// Règles express-validator, si la description est vide remplace par "Aucune description"
const reglesCartes = [
    body("nomCarte")
        .trim()
        .notEmpty().withMessage('Le nom de la carte est obligatoire')
        .isString().withMessage('Le nom devrait être un string'),
    body("image")
        .trim()
        .notEmpty().withMessage('L\'url de l\'image de la carte est obligatoire')
        .isString().withMessage('Le nom devrait être un string'),
    body("description")
        .trim()
        // default prends en compte un champ absent (undefined), null, chaine vide (''), NaN
        .default('Aucune description')
        .isString().withMessage('La description devrait être un string'),
    body("rarete")
        .trim()
        .notEmpty().withMessage('La rareté de la carte est obligatoire')
        .isInt().withMessage('La rareté de la carte devrait être un int'),
    body("valeur")
        .trim()
        .notEmpty().withMessage('La valeur par défaut de la carte est obligatoire')
        .isInt().withMessage('La valeur de la carte devrait être un int'),
    body("mana")
        .trim()
        .notEmpty().withMessage('Le mana de la carte est obligatoire')
        .isInt().withMessage('Le mana de la carte devrait être un int'),
    body("health")
        .trim()
        .notEmpty().withMessage('La vie de la carte est obligatoire')
        .isInt().withMessage('La vie de la carte devrait être un int'),
    body("damage")
        .trim()
        .notEmpty().withMessage('Le dégât de la carte est obligatoire')
        .isInt().withMessage('Le dégât de la carte devrait être un int'),
]

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

// POST pour ajouter de nouvelles cartes
router.post("/add", async (req, res) => {
    try {
        const { nomCarte, image, description, rarete, valeur, mana, health, damage } = req.body
        const resultat = validationResult(req)
        // S'il y a des erreurs, renvoye une liste de toutes les erreurs
        if (!resultat.isEmpty()) {
            return res.status(400).json({ erreurs: erreurs.array() })
        }
        // les $1, $2, etc, sont une méthode incluse avec postgresql, qui aident a garder les accents, charactères spéciaux, et aussi à contrer les injections sql. 
        // postgresql remplace $1 par la premiere valeur dans la liste donnée en 2e argument a .query, ici nomCarte. 
        const reponse = await pool.query(`insert into carte (nom_carte, image, description, rarete, valeur, mana, health, damage) 
            values ($1, $2, $3, $4, $5, $6, $7, $8)
            returning *`,
            [nomCarte, image, description, rarete, valeur, mana, health, damage])
        return res.status(201).json(reponse.rows[0])
    } catch (error) {
        console.error("Erreur dans /collection/add", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})