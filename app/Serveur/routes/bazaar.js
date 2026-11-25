import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from "express-validator"
import { checkAuth } from "../middlewares/checkAuth.js"
import { broadcastBazaarUpdate } from "../services/bazaarRealTimeService.js"

const router = express.Router()

// GET : toutes les cartes du jeu, avec le nombre d'exemplaires en vente chez les autres joueurs et le prix le plus bas
router.get("/cartes", checkAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `select c.*,
                    count(v.id_transaction)::int as quantite_en_vente,
                    count(distinct v.id_vendeur)::int as nb_vendeurs,
                    min(v.prix) as prix_min
             from carte c
             left join ventes v on v.id_carte = c.id_carte and v.id_acheteur is null and v.id_vendeur <> $1
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

// GET : toutes les offres de vente ouvertes des autres joueurs, avec la carte, le vendeur et le prix.
// Chaque ligne de `ventes` est un seul exemplaire (quantite = 1).
router.get("/offres", checkAuth, async (req, res) => {
    try {
        // TODO: update requete sql pour mettre dans vente
        const result = await pool.query(
            `select c.*, v.id_transaction as id_offre, v.id_vendeur, u.nom_utilisateur as vendeur,
                    1 as quantite, v.prix as prix_unitaire, v.date_mise_en_vente as cree_le
             from ventes v
             join carte c on c.id_carte = v.id_carte
             join utilisateurs u on u.id = v.id_vendeur
             where v.id_acheteur is null and v.id_vendeur <> $1
             order by c.id_carte desc, v.prix asc, v.date_mise_en_vente asc, v.id_transaction asc`,
            [req.user.id]
        )
        res.status(200).json(result.rows)
    } catch (error) {
        console.error("Erreur dans GET /bazaar/offres", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// GET : historique des transactions complétées du joueur connecté (cartes vendues et achetées).
// `type` vaut "vente" si le joueur était le vendeur, "achat" s'il était l'acheteur.
router.get("/historique", checkAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `select v.id_transaction, v.id_carte, c.nom_carte, c.rarete, v.prix,
                    1 as quantite,
                    to_char(v.date_mise_en_vente, 'YYYY-MM-DD') as date_mise_en_vente,
                    to_char(v.date_transaction, 'YYYY-MM-DD') as date_transaction,
                    case when v.id_vendeur = $1 then 'vente' else 'achat' end as type,
                    uv.nom_utilisateur as vendeur, ua.nom_utilisateur as acheteur
             from ventes v
             join carte c on c.id_carte = v.id_carte
             join utilisateurs uv on uv.id = v.id_vendeur
             join utilisateurs ua on ua.id = v.id_acheteur
             where v.id_acheteur is not null and (v.id_vendeur = $1 or v.id_acheteur = $1)
             order by v.date_transaction desc, v.id_transaction desc`,
            [req.user.id]
        )
        res.status(200).json(result.rows)
    } catch (error) {
        console.error("Erreur dans GET /bazaar/historique", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// POST : achète une offre précise (un exemplaire), au prix fixé par le vendeur.
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

            // TODO: update requete sql pour mettre dans vente
            // Verrouille l'offre pour éviter que deux acheteurs l'achètent en même temps
            // Verrouille l'offre ouverte pour éviter que deux acheteurs l'achètent en même temps
            const offreResult = await client.query(
                `select id_transaction as id_offre, id_vendeur, id_carte, 1 as quantite, prix as prix_unitaire
                 from ventes where id_transaction = $1 and id_acheteur is null for update`,
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

            // Le vendeur reçoit ses crédits
            await client.query("update utilisateurs set credits = credits + $1 where id = $2", [total, offre.id_vendeur])

            // TODO: update requete sql pour mettre dans vente
            // Historique
            // Complète la vente : la ligne de `ventes` sert aussi d'historique
            await client.query(
                "update ventes set id_acheteur = $1, date_transaction = current_date where id_transaction = $2",
                [idAcheteur, offre.id_offre]
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
            // transmission de l'update de l'état des offres sur la carte au socket.io
            broadcastBazaarUpdate(offre.id_carte)
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
// ouvertes de la moins chère à la plus chère. Tout se fait dans une transaction : tout est acheté ou rien.
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

            // Verrouille les `quantite` offres ouvertes les moins chères des autres joueurs pour cette carte
            const offresResult = await client.query(
                `select id_transaction as id_offre, id_vendeur, id_carte, prix as prix_unitaire
                 from ventes
                 where id_carte = $1 and id_vendeur <> $2 and id_acheteur is null
                 order by prix asc, date_mise_en_vente asc, id_transaction asc
                 limit $3
                 for update`,
                [idCarte, idAcheteur, quantite]
            )
            const achats = offresResult.rows

            if (achats.length < quantite) {
                await client.query("rollback")
                return res.status(409).json({ error: "Pas assez d'exemplaires en vente pour cette carte" })
            }

            const total = achats.reduce((somme, offre) => somme + offre.prix_unitaire, 0)

            // Débite l'acheteur seulement s'il a assez de crédits
            const debit = await client.query(
                "update utilisateurs set credits = credits - $1 where id = $2 and credits >= $1 returning credits",
                [total, idAcheteur]
            )
            if (debit.rows.length === 0) {
                await client.query("rollback")
                return res.status(400).json({ error: "Crédits insuffisants" })
            }

            for (const offre of achats) {
                await client.query(
                    "update ventes set id_acheteur = $1, date_transaction = current_date where id_transaction = $2",
                    [idAcheteur, offre.id_offre]
                )
                await client.query("update utilisateurs set credits = credits + $1 where id = $2", [offre.prix_unitaire, offre.id_vendeur])
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
