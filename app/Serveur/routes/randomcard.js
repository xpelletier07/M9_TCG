import express from 'express'
import { pool } from './../db/pool.js'
import { checkAuth } from '../middlewares/checkAuth.js'

const router = express.Router()

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

export default router
