import { pool } from "./../db/pool.js"
import express from "express"
import { body, validationResult } from 'express-validator'
import { checkAdmin, checkAuth } from './../middlewares/checkAuth.js'

const router = express.Router()

// GET obtenir les 5 prix les plus bas pour une carte donnée en params
router.get('/:id', checkAuth, async (req, res)=>{
    
})


// GET obtenir ses offres de ventes actives



// POST nouvelle offre de vente sur le Bazaar, 


export default router