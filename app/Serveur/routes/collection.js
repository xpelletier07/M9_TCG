import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from 'express-validator'
import { checkAdmin, checkAuth } from './../middlewares/checkAuth.js'

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
router.get("/all", checkAuth, async (req, res) => {
    try {
        const result = await pool.query("select * from carte order by id_carte desc")
        res.status(200).json(result.rows)
    } catch (error) {
        console.error("Erreur dans /collection/all", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// GET pour obtenir une carte spécifique
router.get("/:id", checkAuth, async (req, res) => {
    try {
        const id_carte = Number(req.params.id)
        const result = await pool.query("select * from carte where id_carte = $1", [id_carte])
        // si aucuns résultats, erreur 404
        if (result.rows.length === 0) {
            return res.status(404).json({ erreur: "Id non trouvé dans la bd." })
        }
        // si résultat(s), affiche le premier seulement.
        res.status(200).json(result.rows[0])
    } catch (error) {
        console.error("Erreur dans GET /collection/:id", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// POST pour ajouter de nouvelles cartes
router.post("/card", checkAdmin, reglesCartes, async (req, res) => {
    try {
        const { nomCarte, image, description, rarete, valeur, mana, health, damage } = req.body
        const resultat = validationResult(req)
        // S'il y a des erreurs, renvoye une liste de toutes les erreurs
        if (!resultat.isEmpty()) {
            return res.status(400).json({ erreurs: resultat.array() })
        }
        // les $1, $2, etc, sont une méthode incluse avec postgresql, qui aident a garder les accents, charactères spéciaux, et aussi à contrer les injections sql. 
        // postgresql remplace $1 par la premiere valeur dans la liste donnée en 2e argument a .query, ici nomCarte. 
        const reponse = await pool.query(`insert into carte (nom_carte, image, description, rarete, valeur, mana, health, damage) 
            values ($1, $2, $3, $4, $5, $6, $7, $8)
            returning *`,
            [nomCarte, image, description, rarete, valeur, mana, health, damage])
        return res.status(201).json(reponse.rows[0])
    } catch (error) {
        console.error("Erreur dans POST /collection/add", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// PATCH pour modifier une carte spécifique selon son id
router.patch("/:id", checkAdmin, async (req, res) => {
    try {
        const id = req.params.id
        const { nomCarte, image, description, rarete, valeur, mana, health, damage } = req.body
        const champs = {}
        if (nomCarte !== undefined) champs.nom_carte = nomCarte
        if (image !== undefined) champs.image = image
        if (description !== undefined) champs.description = description
        if (rarete !== undefined) champs.rarete = rarete
        if (valeur !== undefined) champs.valeur = valeur
        if (mana !== undefined) champs.mana = mana
        if (health !== undefined) champs.health = health
        if (damage !== undefined) champs.damage = damage
        const cles = Object.keys(champs)
        if (cles.length === 0) {
            return res.status(400).json({ message: "Aucun champ à mettre à jour" })
        }
        const resultat = validationResult(req)
        if (!resultat.isEmpty()) {
            return res.status(400).json({ erreurs: resultat.array() })
        }
        const setClause = cles.map((cle, i) => `"${cle}" = $${i + 1}`).join(', ')
        const valeurs = Object.values(champs)
        // update seulement les valeurs qui ont étés changées
        const { rows } = await pool.query(`UPDATE carte SET ${setClause} WHERE id_carte = $${cles.length + 1} RETURNING *`, [...valeurs, id])
        if (rows.length === 0) {
            return res.status(404).json({ message: "Carte non trouvée" })
        }
        res.status(200).json(rows[0])
    } catch (error) {
        console.error("Erreur dans PATCH /collection/:id", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// DELETE pour supprimer une carte de la collection
router.delete("/:id", checkAdmin, async (req, res)=>{
    try {
        const id = req.params.id
        const resultat = await pool.query("delete from carte where id_carte = $1", [id])
        // si resultat n'a rien de deleté, pas trouvé dans la bd
        if (resultat.rowCount === 0){
            return res.status(404).json({ message: "Carte non trouvée" })
        }
        // si tout est ok, renvoye pas de body avec 204
        res.status(204).send()
    } catch (error) {
        console.error("Erreur dans DELETE /collection/:id", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

export default router
