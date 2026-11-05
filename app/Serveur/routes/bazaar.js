import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from "express-validator"
import { checkAuth } from "../middlewares/checkAuth.js"

const router = express.Router()

// GET : toutes les offres de vente des autres joueurs, avec la carte, le vendeur, la quantité et le prix unitaire
router.get("/offres", checkAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `select c.*, o.id_offre, o.id_vendeur, u.nom_utilisateur as vendeur, o.quantite, o.prix_unitaire
             from bazaar_offre o
             join carte c on c.id_carte = o.id_carte
             join utilisateurs u on u.id = o.id_vendeur
             where o.id_vendeur <> $1
             order by c.id_carte desc, o.prix_unitaire asc, o.cree_le asc`,
            [req.user.id]
        )
        res.status(200).json(result.rows)
    } catch (error) {
        console.error("Erreur dans GET /bazaar/offres", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// POST : achète `quantite` exemplaires (1 par défaut) d'une offre précise, au prix fixé par le vendeur.
// Tout se fait dans une transaction : si une étape échoue, rien n'est appliqué.
router.post(
    "/acheter",
    checkAuth,
    body("id_offre").isInt({ min: 1 }).withMessage("id_offre invalide"),
    body("quantite").optional().isInt({ min: 1, max: 1000 }).withMessage("La quantité doit être un entier d'au moins 1"),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const idAcheteur = req.user.id
        const idOffre = Number(req.body.id_offre)
        const quantite = Number(req.body.quantite ?? 1)

        const client = await pool.connect()
        try {
            await client.query("begin")

            // Verrouille l'offre pour éviter que deux acheteurs l'achètent en même temps
            const offreResult = await client.query(
                "select id_offre, id_vendeur, id_carte, quantite, prix_unitaire from bazaar_offre where id_offre = $1 for update",
                [idOffre]
            )
            const offre = offreResult.rows[0]

            if (!offre) {
                await client.query("rollback")
                return res.status(404).json({ error: "Offre introuvable (elle a peut-être déjà été achetée)" })
            }
            if (offre.id_vendeur === idAcheteur) {
                await client.query("rollback")
                return res.status(400).json({ error: "Vous ne pouvez pas acheter votre propre offre" })
            }
            if (quantite > offre.quantite) {
                await client.query("rollback")
                return res.status(409).json({ error: "Quantité insuffisante dans cette offre" })
            }

            const total = quantite * offre.prix_unitaire

            // Débite l'acheteur seulement s'il a assez de crédits
            const debit = await client.query(
                "update utilisateurs set credits = credits - $1 where id = $2 and credits >= $1 returning credits",
                [total, idAcheteur]
            )
            if (debit.rows.length === 0) {
                await client.query("rollback")
                return res.status(400).json({ error: "Crédits insuffisants" })
            }

            // Retire les cartes achetées de l'offre (supprime l'offre si elle est épuisée)
            if (quantite === offre.quantite) {
                await client.query("delete from bazaar_offre where id_offre = $1", [offre.id_offre])
            } else {
                await client.query("update bazaar_offre set quantite = quantite - $1 where id_offre = $2", [quantite, offre.id_offre])
            }

            // Le vendeur reçoit ses crédits
            await client.query("update utilisateurs set credits = credits + $1 where id = $2", [total, offre.id_vendeur])

            // Historique
            await client.query(
                `insert into bazaar_transaction (id_acheteur, id_vendeur, id_carte, quantite, prix_unitaire)
                 values ($1, $2, $3, $4, $5)`,
                [idAcheteur, offre.id_vendeur, offre.id_carte, quantite, offre.prix_unitaire]
            )

            // Ajoute les cartes à l'inventaire de l'acheteur
            await client.query(
                `insert into inventaire_carte (id_utilisateur, id_carte, quantite)
                 values ($1, $2, $3)
                 on conflict (id_utilisateur, id_carte)
                 do update set quantite = inventaire_carte.quantite + excluded.quantite`,
                [idAcheteur, offre.id_carte, quantite]
            )

            await client.query("commit")
            res.status(200).json({ id_offre: offre.id_offre, id_carte: offre.id_carte, quantite, total, credits: debit.rows[0].credits })
        } catch (error) {
            try { await client.query("rollback") } catch { /* connexion déjà fermée */ }
            console.error("Erreur dans POST /bazaar/acheter", error)
            res.status(500).json({ error: "Erreur serveur" })
        } finally {
            client.release()
        }
    }
)

export default router
