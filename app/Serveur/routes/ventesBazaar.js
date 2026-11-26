import { pool } from "./../db/pool.js"
import express from "express"
import { checkAuth } from './../middlewares/checkAuth.js'
import { broadcastBazaarUpdate } from './../services/bazaarRealTimeService.js'

const router = express.Router()

// GET obtenir ses offres de ventes actives
router.get('/me', checkAuth, async (req, res) => {
    try {
        const idUser = req.user.id
        const result = await pool.query(`
            select * from ventes where id_vendeur = $1`, [idUser])
        if (result.rowCount === 0) {
            return res.status(200).json({})
        }
        else {
            return res.status(200).json(result.rows)
        }
    }
    catch (error) {
        console.error("Erreur dans GET /venteBazaar/me", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

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

// POST nouvelle offre de vente sur le Bazaar
router.post('/:id', checkAuth, async (req, res) => {
    try {
        const idCarte = Number(req.params.id)
        const idUser = Number(req.user.id)
        const prix = Number(req.body.prix)
        if (prix === null || prix < 0) {
            return res.status(400).json({ error: "Veuillez donner un prix positif pour l'offre de vente." })
        }
        // let puisqu'on doit faire plusieurs requettes à la bd
        let reponse = await pool.query(`
            SELECT quantite FROM inventaire_carte WHERE id_utilisateur = $1 AND id_carte = $2
            `, [idUser, idCarte])
        // si la carte n'existe pas dans l'inventaire du joueur
        if (reponse.rowCount === 0 || reponse.rows[0] < 1) {
            return res.status(400).json({ error: "Vous n'avez pas cette carte dans votre inventaire" })
        }
        // enleve un exemplaire de la carte de l'inventaire de l'utilisateur, rajoute encore le quantité > 0 pour etre sur qu'il n'y a pas de bug avec le await d'avant
        reponse = await pool.query(`UPDATE inventaire_carte SET quantite = quantite - 1 WHERE id_utilisateur = $1 AND id_carte = $2 AND quantite > 0`, [idUser, idCarte])
        // si jamais une erreur et rien n'a été updaté
        if (reponse.rowCount === 0) {
            return res.status(400).json({ error: "Erreur lors de la mise à jour en base de données" })
        }
        // ajoute l'offre de vente
        reponse = await pool.query(`
            INSERT INTO ventes (id_vendeur, id_carte, prix) 
            VALUES ($1, $2, $3)`, [idUser, idCarte, prix])
        broadcastBazaarUpdate(idCarte)
        return res.status(201).json(reponse.rows[0])
    }
    catch (error) {
        console.error("Erreur dans POST /venteBazaar/:id", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})


export default router