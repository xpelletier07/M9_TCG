import express from "express"
import authRouter from "../routes/auth.js"
import carteRouter from "../routes/carte.js"
import collectionRouter from "../routes/collection.js"
import inventaireRouter from "../routes/inventaire.js"
import inventoryRouter from "../routes/decks.js"
import packsRouter from "../routes/packs.js"
import inventairePackRouter from "../routes/inventairePack.js"

const apiRouter = express.Router()

apiRouter.use("/auth", authRouter)
apiRouter.use("/collection", collectionRouter)
apiRouter.use("/inventory", inventoryRouter)
apiRouter.use("/pack", packsRouter)
apiRouter.use("/inventaire-pack", inventairePackRouter)
apiRouter.use(carteRouter)
apiRouter.use(inventaireRouter)

export default apiRouter
