import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from 'express-validator'
import { checkAuth } from './../middlewares/checkAuth.js'

const router = express.Router()

// GET obtenir les 5 prix les plus bas pour une carte donnée en params
router.get('/:id', checkAuth, async (req, res) => {
    try {
        const id = Number(req.params.id)
        // prends aussi si == null puisque lorsqu'une offre est completée on mets l'id de l'acheteur
        const result = await pool.query(`
            select * from ventes where id_carte = $1 and id_acheteur = null
            order by prix asc limit 5`, [id])
        // si aucunes offres de ventes ouvertes pour la carte demandée
        if (result.rowCount === 0) {
            return res.status(200).json({})
        }
        else {
            return res.status(200).json(result.rows)
        }
    }
    catch (error) {
        console.error("Erreur dans GET /venteBazaar/:id", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// GET obtenir ses offres de ventes actives
router.get('/me', checkAuth, async (req, res) => {
    try {
        const idUser = req.user.id
        const result = await pool.query(`
            select * from ventes where id_vendeur = $1`, [idUser])
    }
    catch (error) {
        console.error("Erreur dans GET /venteBazaar/me", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})


// POST nouvelle offre de vente sur le Bazaar, 


export default router