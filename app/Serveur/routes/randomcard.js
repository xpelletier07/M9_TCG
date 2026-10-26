import express from 'express'
import { pool } from './../db/pool.js'
import { checkAuth } from '../middlewares/checkAuth.js'

const router = express.Router()
const CLAIM_COOLDOWN_SECONDS = 5 * 60
// Etat en memoire pour synchroniser un round global de claim entre tous les joueurs connectes.
const globalClaimState = {
	cooldownEndsAtMs: 0,
	roundClaimedCardIds: new Set(),
	roundCards: [],
}

const rarityWeights = [
	{ rarete: 4, weight: 1 },
	{ rarete: 3, weight: 9 },
	{ rarete: 2, weight: 20 },
	{ rarete: 1, weight: 70 },
]

// Fonction pour sélectionner une rareté en fonction des poids
function pickRarity(availableCards) {
	const availableWeights = rarityWeights.filter(({ rarete }) => availableCards.some((carte) => carte.rarete === rarete))

	if (availableWeights.length === 0) {
		return null
	}

	const totalWeight = availableWeights.reduce((sum, entry) => sum + entry.weight, 0)
	let roll = Math.random() * totalWeight

	for (const entry of availableWeights) {
		roll -= entry.weight
		if (roll <= 0) {
			return entry.rarete
		}
	}

	return availableWeights[availableWeights.length - 1].rarete
}

// fuction de sélection aléatoire de cartes en fonction de la rareté
function pickRandomCards(cards, count) {
	const remainingCards = [...cards]
	const selectedCards = []

	while (selectedCards.length < count && remainingCards.length > 0) {
		const rarete = pickRarity(remainingCards)

		let cardIndex = remainingCards.findIndex((carte) => carte.rarete === rarete)
		if (cardIndex === -1) {
			cardIndex = 0
		}

		const [selectedCard] = remainingCards.splice(cardIndex, 1)
		selectedCards.push(selectedCard)
	}

	return selectedCards
}

function refreshGlobalState() {
	// A la fin du cooldown global, on reinitialise completement le round suivant.
	if (globalClaimState.cooldownEndsAtMs <= 0) {
		return
	}

	if (Date.now() >= globalClaimState.cooldownEndsAtMs) {
		globalClaimState.cooldownEndsAtMs = 0
		globalClaimState.roundClaimedCardIds.clear()
		globalClaimState.roundCards = []
	}
}

function getGlobalCooldownPayload() {
	refreshGlobalState()

	if (globalClaimState.cooldownEndsAtMs <= 0) {
		return {
			cooldownRemainingSeconds: 0,
			cooldownResetAt: null,
		}
	}

	const cooldownRemainingSeconds = Math.max(
		0,
		Math.ceil((globalClaimState.cooldownEndsAtMs - Date.now()) / 1000)
	)

	return {
		cooldownRemainingSeconds,
		cooldownResetAt: new Date(globalClaimState.cooldownEndsAtMs).toISOString(),
	}
}

async function getOrCreateRoundCards(count = 3) {
	// Toutes les personnes du round voient les memes cartes tant que le round n'est pas termine.
	if (globalClaimState.roundCards.length > 0) {
		return globalClaimState.roundCards
	}

	const result = await pool.query('select * from carte order by id_carte asc')
	const cards = result.rows

	if (cards.length === 0) {
		return []
	}

	const selectedCards = pickRandomCards(cards, count)
	globalClaimState.roundCards = selectedCards
	return globalClaimState.roundCards
}


// Route pour obtenir des cartes aléatoires
router.get('/random', checkAuth, async (req, res) => {
	const requestedCount = Number.parseInt(req.query.count, 10)
	const count = Number.isInteger(requestedCount) && requestedCount > 0 ? Math.min(requestedCount, 10) : 3

	try {
		const result = await pool.query('select * from carte order by id_carte asc')
		const cards = result.rows

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
		const cooldownPayload = getGlobalCooldownPayload()
		const isCooldownActive = cooldownPayload.cooldownRemainingSeconds > 0

		return res.status(200).json({
			canClaim: !isCooldownActive,
			hasClaimedCurrentRound: false,
			claimedCardIds: Array.from(globalClaimState.roundClaimedCardIds),
			claimedCount: 0,
			expectedClaimCount: 0,
			...cooldownPayload,
		})
	} catch (error) {
		console.error('Erreur dans GET /cards/claim/status', error)
		return res.status(500).json({ error: 'Erreur serveur' })
	}
})

router.get('/claim/options', checkAuth, async (_req, res) => {
	try {
		const cooldownPayload = getGlobalCooldownPayload()
		// Pendant le cooldown global on masque les choix de cartes.
		if (cooldownPayload.cooldownRemainingSeconds > 0) {
			return res.status(200).json({ cards: [], claimedCardIds: [] })
		}

		const cards = await getOrCreateRoundCards(3)
		if (cards.length === 0) {
			return res.status(404).json({ error: 'Aucune carte disponible' })
		}

		return res.status(200).json({
			cards,
			claimedCardIds: Array.from(globalClaimState.roundClaimedCardIds),
		})
	} catch (error) {
		console.error('Erreur dans GET /cards/claim/options', error)
		return res.status(500).json({ error: 'Erreur serveur' })
	}
})

router.post('/claim', checkAuth, async (req, res) => {
	const rawCardId = req.body?.id_carte
	const idCarte = Number.parseInt(rawCardId, 10)

	if (!Number.isInteger(idCarte) || idCarte <= 0) {
		return res.status(400).json({ error: 'id_carte invalide' })
	}

	try {
		const cooldownPayload = getGlobalCooldownPayload()
		const isCooldownActive = cooldownPayload.cooldownRemainingSeconds > 0

		if (isCooldownActive) {
			return res.status(429).json({
				error: 'Cooldown global actif pour le claim de carte',
				canClaim: false,
				hasClaimedCurrentRound: false,
				claimedCardIds: Array.from(globalClaimState.roundClaimedCardIds),
				claimedCount: 0,
				expectedClaimCount: 0,
				...cooldownPayload,
			})
		}

		const cardResult = await pool.query('select id_carte from carte where id_carte = $1', [idCarte])
		if (cardResult.rows.length === 0) {
			return res.status(404).json({ error: 'Carte introuvable' })
		}

		// Une carte choisie par un joueur devient indisponible pour les autres du meme round.
		if (globalClaimState.roundClaimedCardIds.has(idCarte)) {
			return res.status(409).json({
				error: 'Cette carte a deja ete claim par un autre joueur',
				canClaim: true,
				hasClaimedCurrentRound: false,
				claimedCardIds: Array.from(globalClaimState.roundClaimedCardIds),
				claimedCount: 0,
				expectedClaimCount: 0,
				cooldownRemainingSeconds: 0,
				cooldownResetAt: null,
			})
		}

		await pool.query(
			`insert into inventaire_carte (id_utilisateur, id_carte, quantite)
			 values ($1, $2, 1)
			 on conflict (id_utilisateur, id_carte)
			 do update set quantite = inventaire_carte.quantite + 1`,
			[req.user.id, idCarte]
		)

		// Le premier claim valide du cycle demarre immediatement le cooldown global.
		globalClaimState.roundClaimedCardIds.add(idCarte)
		globalClaimState.cooldownEndsAtMs = Date.now() + CLAIM_COOLDOWN_SECONDS * 1000
		globalClaimState.roundCards = []
		const nextCooldownPayload = getGlobalCooldownPayload()

		return res.status(201).json({
			message: 'Carte réclamée avec succès',
			id_carte: idCarte,
			canClaim: false,
			hasClaimedCurrentRound: false,
			claimedCardIds: Array.from(globalClaimState.roundClaimedCardIds),
			claimedCount: 0,
			expectedClaimCount: 0,
			...nextCooldownPayload,
		})
	} catch (error) {
		console.error('Erreur dans POST /cards/claim', error)
		return res.status(500).json({ error: 'Erreur serveur' })
	}
})

export default router
