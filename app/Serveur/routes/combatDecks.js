import express from "express"
import { checkAuth } from "../middlewares/checkAuth.js"
import { listValidDecks } from "../game/deckService.js"

const router = express.Router()

router.use(checkAuth)

// Decks du joueur utilisables en combat (50 cartes, toutes disponibles dans l'inventaire)
router.get("/decks", async (req, res) => {
    try {
        res.json(await listValidDecks(req.user.id))
    } catch (error) {
        console.error("Erreur dans /combat/decks", error)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

export default router
