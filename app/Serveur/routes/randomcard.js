import express from 'express'
import { pool } from './../db/pool.js'
import { checkAuth } from '../middlewares/checkAuth.js'
import {
	pickRandomCards,
	getOrCreateRoundCards,
	getDropCommunState,
	registerClaimedCard,
	globalClaimState,
} from '../services/dropCommunService.js'

const router = express.Router()

// Route pour obtenir des cartes aléatoires
router.get('/random', checkAuth, async (req, res) => {
	const requestedCount = Number.parseInt(req.query.count, 10)
	const count = Number.isInteger(requestedCount) && requestedCount > 0 ? Math.min(requestedCount, 10) : 3

	try {
		const result = await pool.query('select * from carte order by id_carte asc')
		const cards = result.rows || []

		if (cards.length === 0) {
			return res.status(404).json({ error: 'Aucune carte disponible' })
		}

		const selectedCards = pickRandomCards(cards, count)
		return res.status(200).json(selectedCards)
	} catch (error) {
		console.error('Erreur dans GET /cards/random', error)
		return res.status(500).json({ error: 'Erreur serveur' })
	}
})

router.get('/claim/status', checkAuth, async (req, res) => {
	try {
		const dropState = await getDropCommunState(req.user?.id)

		return res.status(200).json({
			canClaim: dropState.canClaim,
			hasClaimedCurrentRound: dropState.hasClaimedCurrentRound,
			connectedUsers: dropState.connectedUsers,
			claimedCardIds: dropState.claimedCardIds,
			claimedCount: dropState.claimedCount,
			expectedClaimCount: dropState.expectedClaimCount,
			cooldownRemainingSeconds: dropState.cooldownRemainingSeconds,
			cooldownResetAt: dropState.cooldownResetAt,
		})
	} catch (error) {
		console.error('Erreur dans GET /cards/claim/status', error)
		return res.status(500).json({ error: 'Erreur serveur' })
	}
})

router.get('/claim/options', checkAuth, async (req, res) => {
	try {
		const dropState = await getDropCommunState(req.user?.id)

		// Pendant le cooldown global, on masque les choix de cartes.
		if (dropState.isCooldownActive) {
			return res.status(200).json({ cards: [], claimedCardIds: dropState.claimedCardIds })
		}

		const cards = await getOrCreateRoundCards(3)
		if (cards.length === 0) {
			return res.status(404).json({ error: 'Aucune carte disponible' })
		}

		return res.status(200).json({
			cards,
			claimedCardIds: dropState.claimedCardIds,
		})
	} catch (error) {
		console.error('Erreur dans GET /cards/claim/options', error)
		return res.status(500).json({ error: 'Erreur serveur' })
	}
})

router.post('/claim', checkAuth, async (req, res) => {
	const rawCardId = req.body?.id_carte
	const idCarte = Number.parseInt(rawCardId, 10)
	const userId = req.user?.id

	if (!Number.isInteger(idCarte) || idCarte <= 0) {
		return res.status(400).json({ error: 'id_carte invalide' })
	}

	try {
		const dropState = await getDropCommunState(userId)

		if (dropState.isCooldownActive) {
			return res.status(429).json({
				error: 'Cooldown global actif pour le claim de carte',
				canClaim: false,
				hasClaimedCurrentRound: dropState.hasClaimedCurrentRound,
				connectedUsers: dropState.connectedUsers,
				claimedCardIds: dropState.claimedCardIds,
				claimedCount: dropState.claimedCount,
				expectedClaimCount: dropState.expectedClaimCount,
				cooldownRemainingSeconds: dropState.cooldownRemainingSeconds,
				cooldownResetAt: dropState.cooldownResetAt,
			})
		}

		// Vérifier si le joueur a déjà claim une carte dans ce round
		if (dropState.hasClaimedCurrentRound) {
			return res.status(400).json({
				error: 'Vous avez déjà réclamé une carte pour ce round',
				canClaim: false,
				hasClaimedCurrentRound: true,
				connectedUsers: dropState.connectedUsers,
				claimedCardIds: dropState.claimedCardIds,
				claimedCount: dropState.claimedCount,
				expectedClaimCount: dropState.expectedClaimCount,
				cooldownRemainingSeconds: dropState.cooldownRemainingSeconds,
				cooldownResetAt: dropState.cooldownResetAt,
			})
		}

		const cardResult = await pool.query('select id_carte from carte where id_carte = $1', [idCarte])
		if (!cardResult.rows || cardResult.rows.length === 0) {
			return res.status(404).json({ error: 'Carte introuvable' })
		}

		// Une carte choisie par un joueur devient indisponible pour les autres.
		if (dropState.claimedCardIds.includes(idCarte)) {
			return res.status(409).json({
				error: 'Cette carte a deja ete claim par un autre joueur',
				canClaim: !dropState.hasClaimedCurrentRound,
				hasClaimedCurrentRound: dropState.hasClaimedCurrentRound,
				connectedUsers: dropState.connectedUsers,
				claimedCardIds: dropState.claimedCardIds,
				claimedCount: dropState.claimedCount,
				expectedClaimCount: dropState.expectedClaimCount,
				cooldownRemainingSeconds: dropState.cooldownRemainingSeconds,
				cooldownResetAt: dropState.cooldownResetAt,
			})
		}

		await pool.query(
			`insert into inventaire_carte (id_utilisateur, id_carte, quantite)
			 values ($1, $2, 1)
			 on conflict (id_utilisateur, id_carte)
			 do update set quantite = inventaire_carte.quantite + 1`,
			[userId, idCarte]
		)

		// On enregistre le claim pour cette carte et ce joueur
		const updatedState = registerClaimedCard(idCarte, userId)

		return res.status(201).json({
			message: 'Carte réclamée avec succès',
			id_carte: idCarte,
			canClaim: false,
			hasClaimedCurrentRound: true,
			connectedUsers: updatedState.connectedUsers,
			claimedCardIds: updatedState.claimedCardIds,
			claimedCount: updatedState.claimedCount,
			expectedClaimCount: updatedState.expectedClaimCount,
			cooldownRemainingSeconds: updatedState.cooldownRemainingSeconds,
			cooldownResetAt: updatedState.cooldownResetAt,
		})
	} catch (error) {
		console.error('Erreur dans POST /cards/claim', error)
		return res.status(500).json({ error: 'Erreur serveur' })
	}
})

export default router
