import { pool } from '../db/pool.js'
import express from 'express'
import { checkAuth } from '../middlewares/checkAuth.js'

const router = express.Router();

router.use(checkAuth);

// Route pour récupérer les informations d'un combat par son ID
router.get('/combat/:id', async (req, res) => {
    const combatId = req.params.id;
    try {
        const result = await pool.query('SELECT * FROM combat WHERE id_combat = $1', [combatId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Combat not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching combat:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



export default router