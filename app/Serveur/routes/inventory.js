import express from "express"
import { pool } from "../db/pool.js"
import { checkAuth } from "../middlewares/checkAuth.js"

const router = express.Router()
const DECK_NAME_MAX_LENGTH = 30

router.use(checkAuth)

router.get("/cards", async (req, res) => {
    try {
        const result = await pool.query(
            `select c.*, i.quantite
             from inventaire_carte i
             join carte c on c.id_carte = i.id_carte
             where i.id_utilisateur = $1
             order by c.nom_carte`,
            [req.user.id]
        )
        res.json(result.rows)
    } catch (error) {
        console.error("Erreur dans /inventory/cards", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.get("/decks", async (req, res) => {
    try {
        const result = await pool.query(
            `select d.id_deck, d.nom_deck, d.cree_le,
                    coalesce(sum(dc.quantite), 0)::int as total_cartes
             from deck d
             left join deck_carte dc on dc.id_deck = d.id_deck
             where d.id_utilisateur = $1
             group by d.id_deck
             order by d.cree_le desc`,
            [req.user.id]
        )
        res.json(result.rows)
    } catch (error) {
        console.error("Erreur dans /inventory/decks", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.get("/decks/:id", async (req, res) => {
    try {
        const result = await pool.query(
            `select d.id_deck, d.nom_deck, d.cree_le,
                    coalesce(json_agg(json_build_object(
                        'id_carte', c.id_carte,
                        'nom_carte', c.nom_carte,
                        'image', c.image,
                        'quantite', dc.quantite
                    ) order by c.nom_carte) filter (where c.id_carte is not null), '[]') as cartes
             from deck d
             left join deck_carte dc on dc.id_deck = d.id_deck
             left join carte c on c.id_carte = dc.id_carte
             where d.id_deck = $1 and d.id_utilisateur = $2
             group by d.id_deck`,
            [req.params.id, req.user.id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Deck introuvable" })
        }

        res.json(result.rows[0])
    } catch (error) {
        console.error("Erreur dans /inventory/getDeck/:id", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.post("/decks", async (req, res) => {
    const nomDeck = typeof req.body.nomDeck === "string" ? req.body.nomDeck.trim() : ""

    if (!nomDeck || nomDeck.length > DECK_NAME_MAX_LENGTH) {
        return res.status(400).json({ error: "Le nom du deck est requis et doit contenir au maximum 30 caractères" })
    }

    try {
        const result = await pool.query(
            `insert into deck (id_utilisateur, nom_deck)
             values ($1, $2)
             returning id_deck, nom_deck, cree_le`,
            [req.user.id, nomDeck]
        )
        res.status(201).json(result.rows[0])
    } catch (error) {
        console.error("Erreur dans /inventory/decks", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.post("/decks/:id/cards/:idCarte", async (req, res) => {
    const quantite = Number.isInteger(req.body.quantite) ? req.body.quantite : 1

    if (quantite < 1) {
        return res.status(400).json({ error: "La quantité doit être supérieure à zéro" })
    }

    const client = await pool.connect()
    try {
        await client.query("begin")

        const deck = await client.query(
            "select id_deck from deck where id_deck = $1 and id_utilisateur = $2 for update",
            [req.params.id, req.user.id]
        )
        if (deck.rows.length === 0) {
            await client.query("rollback")
            return res.status(404).json({ error: "Deck introuvable" })
        }

        const carte = await client.query("select id_carte from carte where id_carte = $1", [req.params.idCarte])
        if (carte.rows.length === 0) {
            await client.query("rollback")
            return res.status(404).json({ error: "Carte introuvable" })
        }

        const possession = await client.query(
            "select quantite from inventaire_carte where id_utilisateur = $1 and id_carte = $2 for update",
            [req.user.id, req.params.idCarte]
        )
        const dansDeck = await client.query(
            "select quantite from deck_carte where id_deck = $1 and id_carte = $2",
            [req.params.id, req.params.idCarte]
        )
        const quantiteActuelle = dansDeck.rows[0]?.quantite ?? 0
        const quantitePossedee = possession.rows[0]?.quantite ?? 0

        if (quantiteActuelle + quantite > quantitePossedee) {
            await client.query("rollback")
            return res.status(409).json({ error: "Quantité de cartes insuffisante dans l'inventaire" })
        }

        const result = await client.query(
            `insert into deck_carte (id_deck, id_carte, quantite)
             values ($1, $2, $3)
             on conflict (id_deck, id_carte)
             do update set quantite = deck_carte.quantite + excluded.quantite
             returning id_deck, id_carte, quantite`,
            [req.params.id, req.params.idCarte, quantite]
        )

        await client.query("commit")
        res.status(201).json(result.rows[0])
    } catch (error) {
        await client.query("rollback")
        console.error("Erreur dans /inventory/decks/:id/cards/:idCarte", error)
        res.status(500).json({ error: "Erreur serveur" })
    } finally {
        client.release()
    }
})

router.delete("/decks/:id/cards/:idCarte", async (req, res) => {
    try {
        const result = await pool.query(
            `delete from deck_carte dc
             using deck d
             where dc.id_deck = d.id_deck
               and dc.id_deck = $1
               and dc.id_carte = $2
               and d.id_utilisateur = $3
             returning dc.id_deck, dc.id_carte`,
            [req.params.id, req.params.idCarte, req.user.id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Carte absente du deck ou deck introuvable" })
        }

        res.status(204).send()
    } catch (error) {
        console.error("Erreur dans /inventory/decks/:id/cards/:idCarte", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.patch("/decks/:id", async (req, res) => {
    const nomDeck = typeof req.body.nomDeck === "string" ? req.body.nomDeck.trim() : ""

    if (!nomDeck || nomDeck.length > DECK_NAME_MAX_LENGTH) {
        return res.status(400).json({ error: "Le nom du deck est requis et doit contenir au maximum 30 caractères" })
    }

    try {
        const result = await pool.query(
            `update deck set nom_deck = $1
             where id_deck = $2 and id_utilisateur = $3
             returning id_deck, nom_deck, cree_le`,
            [nomDeck, req.params.id, req.user.id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Deck introuvable" })
        }

        res.json(result.rows[0])
    } catch (error) {
        console.error("Erreur dans /inventory/decks/:id", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

router.delete("/decks/:id", async (req, res) => {
    try {
        const result = await pool.query(
            "delete from deck where id_deck = $1 and id_utilisateur = $2 returning id_deck",
            [req.params.id, req.user.id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Deck introuvable" })
        }

        res.status(204).send()
    } catch (error) {
        console.error("Erreur dans /inventory/decks/:id", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

export default router
