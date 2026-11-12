import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from "express-validator"
import { checkAuth } from "../middlewares/checkAuth.js"

const router = express.Router()

// GET : toutes les cartes du jeu, avec le nombre d'exemplaires en vente chez les autres joueurs et le prix le plus bas
router.get("/cartes", checkAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `select c.*,
                    coalesce(sum(o.quantite), 0)::int as quantite_en_vente,
                    count(o.id_offre)::int as nb_vendeurs,
                    min(o.prix_unitaire) as prix_min
             from carte c
             left join bazaar_offre o on o.id_carte = c.id_carte and o.id_vendeur <> $1
             group by c.id_carte
             order by c.id_carte asc`,
            [req.user.id]
        )
        res.status(200).json(result.rows)
    } catch (error) {
        console.error("Erreur dans GET /bazaar/cartes", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

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

// POST : achète les `quantite` (1 à 5) exemplaires les moins chers d'une carte, en prenant les offres
// de la moins chère à la plus chère. Tout se fait dans une transaction : tout est acheté ou rien.
router.post(
    "/acheter-moins-chers",
    checkAuth,
    body("id_carte").isInt({ min: 1 }).withMessage("id_carte invalide"),
    body("quantite").isInt({ min: 1, max: 5 }).withMessage("La quantité doit être entre 1 et 5"),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const idAcheteur = req.user.id
        const idCarte = Number(req.body.id_carte)
        const quantite = Number(req.body.quantite)

        const client = await pool.connect()
        try {
            await client.query("begin")

            // Verrouille les offres des autres joueurs pour cette carte, de la moins chère à la plus chère
            const offresResult = await client.query(
                `select id_offre, id_vendeur, id_carte, quantite, prix_unitaire
                 from bazaar_offre
                 where id_carte = $1 and id_vendeur <> $2
                 order by prix_unitaire asc, cree_le asc, id_offre asc
                 for update`,
                [idCarte, idAcheteur]
            )

            // Répartit la quantité demandée sur les offres les moins chères
            const achats = []
            let restant = quantite
            for (const offre of offresResult.rows) {
                if (restant === 0) break
                const prise = Math.min(restant, offre.quantite)
                achats.push({ offre, prise })
                restant -= prise
            }

            if (restant > 0) {
                await client.query("rollback")
                return res.status(409).json({ error: "Pas assez d'exemplaires en vente pour cette carte" })
            }

            const total = achats.reduce((somme, a) => somme + a.prise * a.offre.prix_unitaire, 0)

            // Débite l'acheteur seulement s'il a assez de crédits
            const debit = await client.query(
                "update utilisateurs set credits = credits - $1 where id = $2 and credits >= $1 returning credits",
                [total, idAcheteur]
            )
            if (debit.rows.length === 0) {
                await client.query("rollback")
                return res.status(400).json({ error: "Crédits insuffisants" })
            }

            for (const { offre, prise } of achats) {
                if (prise === offre.quantite) {
                    await client.query("delete from bazaar_offre where id_offre = $1", [offre.id_offre])
                } else {
                    await client.query("update bazaar_offre set quantite = quantite - $1 where id_offre = $2", [prise, offre.id_offre])
                }
                await client.query("update utilisateurs set credits = credits + $1 where id = $2", [prise * offre.prix_unitaire, offre.id_vendeur])
                await client.query(
                    `insert into bazaar_transaction (id_acheteur, id_vendeur, id_carte, quantite, prix_unitaire)
                     values ($1, $2, $3, $4, $5)`,
                    [idAcheteur, offre.id_vendeur, idCarte, prise, offre.prix_unitaire]
                )
            }

            await client.query(
                `insert into inventaire_carte (id_utilisateur, id_carte, quantite)
                 values ($1, $2, $3)
                 on conflict (id_utilisateur, id_carte)
                 do update set quantite = inventaire_carte.quantite + excluded.quantite`,
                [idAcheteur, idCarte, quantite]
            )

            await client.query("commit")
            res.status(200).json({ id_carte: idCarte, quantite, total, nb_offres: achats.length, credits: debit.rows[0].credits })
        } catch (error) {
            try { await client.query("rollback") } catch { /* connexion déjà fermée */ }
            console.error("Erreur dans POST /bazaar/acheter-moins-chers", error)
            res.status(500).json({ error: "Erreur serveur" })
        } finally {
            client.release()
        }
    }
)

export default router
