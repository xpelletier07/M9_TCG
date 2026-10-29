import { pool } from '../db/pool.js'

export const CLAIM_COOLDOWN_SECONDS = 5 * 60 // 5 minutes
export const TOTAL_CARDS_PER_ROUND = 3
const ACTIVE_USER_WINDOW_MS = 25 * 1000 // 25 secondes d'inactivité max

// État partagé en mémoire pour synchroniser le round global de claim entre tous les joueurs.
export const globalClaimState = {
	cooldownEndsAtMs: 0,
	roundClaimedCardIds: new Set(),
	roundClaimedUserIds: new Set(),
	roundCards: [],
	activeUsers: new Map(), // userId -> timestamp
}

let ioInstance = null

export function setDropCommunIo(io) {
	ioInstance = io
}

export function broadcastDropUpdate() {
	if (ioInstance && typeof ioInstance.emit === 'function') {
		ioInstance.emit('drop:updated', {
			timestamp: Date.now(),
		})
	}
}

export function recordUserActivity(userId) {
	if (userId !== undefined && userId !== null) {
		globalClaimState.activeUsers.set(String(userId), Date.now())
	}
}

export function removeUserActivity(userId) {
	if (userId !== undefined && userId !== null) {
		globalClaimState.activeUsers.delete(String(userId))
	}
}

export function getConnectedUsersCount() {
	const now = Date.now()
	for (const [uid, lastSeen] of globalClaimState.activeUsers.entries()) {
		if (now - lastSeen > ACTIVE_USER_WINDOW_MS) {
			globalClaimState.activeUsers.delete(uid)
		}
	}
	return globalClaimState.activeUsers.size
}

export function getExpectedClaimCount() {
	const connected = getConnectedUsersCount()
	const totalCards = Math.max(1, globalClaimState.roundCards.length || TOTAL_CARDS_PER_ROUND)
	const claimedCount = globalClaimState.roundClaimedCardIds.size
	// Le nombre attendu est le nombre de joueurs connectés (minimum 1, au moins le nombre déjà claim, max 3)
	const effective = Math.max(connected, claimedCount, 1)
	return Math.min(totalCards, effective)
}

const rarityWeights = [
	{ rarete: 4, weight: 1 },
	{ rarete: 3, weight: 9 },
	{ rarete: 2, weight: 20 },
	{ rarete: 1, weight: 70 },
]

function pickRarity(availableCards) {
	const availableWeights = rarityWeights.filter(({ rarete }) =>
		availableCards.some((carte) => carte && carte.rarete === rarete)
	)

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

export function pickRandomCards(cards, count) {
	const remainingCards = [...cards]
	const selectedCards = []

	while (selectedCards.length < count && remainingCards.length > 0) {
		const rarete = pickRarity(remainingCards)

		let cardIndex = remainingCards.findIndex((carte) => carte && carte.rarete === rarete)
		if (cardIndex === -1) {
			cardIndex = 0
		}

		const [selectedCard] = remainingCards.splice(cardIndex, 1)
		selectedCards.push(selectedCard)
	}

	return selectedCards
}

export function refreshGlobalDropState() {
	if (globalClaimState.cooldownEndsAtMs <= 0) {
		return
	}

	if (Date.now() >= globalClaimState.cooldownEndsAtMs) {
		// Le cooldown de 5 minutes est terminé : on réinitialise pour le prochain round
		globalClaimState.cooldownEndsAtMs = 0
		globalClaimState.roundClaimedCardIds.clear()
		globalClaimState.roundClaimedUserIds.clear()
		globalClaimState.roundCards = []
		broadcastDropUpdate()
	}
}

export async function getOrCreateRoundCards(count = TOTAL_CARDS_PER_ROUND) {
	refreshGlobalDropState()

	if (globalClaimState.cooldownEndsAtMs > 0) {
		return []
	}

	if (globalClaimState.roundCards.length > 0) {
		return globalClaimState.roundCards
	}

	try {
		const result = await pool.query('select * from carte order by id_carte asc')
		const cards = result?.rows || []

		if (cards.length === 0) {
			return []
		}

		const selectedCards = pickRandomCards(cards, count)
		globalClaimState.roundCards = selectedCards
		return globalClaimState.roundCards
	} catch (error) {
		console.error('Erreur lors du chargement des cartes du round :', error)
		return globalClaimState.roundCards || []
	}
}

export async function getDropCommunState(userId = null) {
	if (userId !== null && userId !== undefined) {
		recordUserActivity(userId)
	}

	refreshGlobalDropState()

	// Si aucun cooldown n'est actif et qu'on n'a pas encore chargé les 3 cartes, on les génère
	if (globalClaimState.cooldownEndsAtMs <= 0 && globalClaimState.roundCards.length === 0) {
		await getOrCreateRoundCards(TOTAL_CARDS_PER_ROUND)
	}

	const totalCards = Math.max(1, globalClaimState.roundCards.length || TOTAL_CARDS_PER_ROUND)
	const claimedCount = globalClaimState.roundClaimedCardIds.size
	const connectedUsers = Math.max(getConnectedUsersCount(), 1)
	const expectedClaimCount = getExpectedClaimCount()
	const hasClaimedCurrentRound = userId ? globalClaimState.roundClaimedUserIds.has(String(userId)) : false

	// 1) Si le cooldown de 5 minutes est en cours
	if (globalClaimState.cooldownEndsAtMs > 0) {
		const remainingSeconds = Math.max(
			0,
			Math.ceil((globalClaimState.cooldownEndsAtMs - Date.now()) / 1000)
		)

		if (remainingSeconds === 0) {
			refreshGlobalDropState()
			return getDropCommunState(userId)
		}

		return {
			isCooldownActive: true,
			canClaim: false,
			hasClaimedCurrentRound,
			isClaimReady: false,
			connectedUsers,
			remainingSeconds,
			cooldownRemainingSeconds: remainingSeconds,
			resetAt: new Date(globalClaimState.cooldownEndsAtMs).toISOString(),
			cooldownResetAt: new Date(globalClaimState.cooldownEndsAtMs).toISOString(),
			claimedCardIds: Array.from(globalClaimState.roundClaimedCardIds),
			claimedCount,
			expectedClaimCount,
		}
	}

	// 2) Si tous les joueurs attendus ont réclamé leur carte, on déclenche le cooldown de 5 minutes
	if (claimedCount >= expectedClaimCount && claimedCount > 0) {
		globalClaimState.cooldownEndsAtMs = Date.now() + CLAIM_COOLDOWN_SECONDS * 1000
		const remainingSeconds = CLAIM_COOLDOWN_SECONDS

		return {
			isCooldownActive: true,
			canClaim: false,
			hasClaimedCurrentRound,
			isClaimReady: false,
			connectedUsers,
			remainingSeconds,
			cooldownRemainingSeconds: remainingSeconds,
			resetAt: new Date(globalClaimState.cooldownEndsAtMs).toISOString(),
			cooldownResetAt: new Date(globalClaimState.cooldownEndsAtMs).toISOString(),
			claimedCardIds: Array.from(globalClaimState.roundClaimedCardIds),
			claimedCount,
			expectedClaimCount,
		}
	}

	// 3) Il reste des joueurs qui peuvent réclamer : le drop est ACTIF
	return {
		isCooldownActive: false,
		canClaim: !hasClaimedCurrentRound,
		hasClaimedCurrentRound,
		isClaimReady: true,
		connectedUsers,
		remainingSeconds: 0,
		cooldownRemainingSeconds: 0,
		resetAt: null,
		cooldownResetAt: null,
		claimedCardIds: Array.from(globalClaimState.roundClaimedCardIds),
		claimedCount,
		expectedClaimCount,
	}
}

export function registerClaimedCard(idCarte, userId = null) {
	globalClaimState.roundClaimedCardIds.add(idCarte)
	if (userId !== undefined && userId !== null) {
		globalClaimState.roundClaimedUserIds.add(String(userId))
		recordUserActivity(userId)
	}

	const claimedCount = globalClaimState.roundClaimedCardIds.size
	const connectedUsers = Math.max(getConnectedUsersCount(), 1)
	const expectedClaimCount = getExpectedClaimCount()

	if (claimedCount >= expectedClaimCount) {
		// Tous les joueurs connectés ont réclamé leur carte !
		// Le drop commun est terminé, on démarre le cooldown de 5 minutes.
		globalClaimState.cooldownEndsAtMs = Date.now() + CLAIM_COOLDOWN_SECONDS * 1000
		broadcastDropUpdate()

		return {
			isCooldownActive: true,
			canClaim: false,
			hasClaimedCurrentRound: true,
			isClaimReady: false,
			connectedUsers,
			cooldownRemainingSeconds: CLAIM_COOLDOWN_SECONDS,
			cooldownResetAt: new Date(globalClaimState.cooldownEndsAtMs).toISOString(),
			claimedCardIds: Array.from(globalClaimState.roundClaimedCardIds),
			claimedCount,
			expectedClaimCount,
		}
	}

	broadcastDropUpdate()

	// Il reste encore des joueurs qui n'ont pas claim
	return {
		isCooldownActive: false,
		canClaim: false, // L'utilisateur qui vient de claim ne peut plus claim
		hasClaimedCurrentRound: true,
		isClaimReady: true,
		connectedUsers,
		cooldownRemainingSeconds: 0,
		cooldownResetAt: null,
		claimedCardIds: Array.from(globalClaimState.roundClaimedCardIds),
		claimedCount,
		expectedClaimCount,
	}
}

export function resetGlobalDropStateForTesting() {
	globalClaimState.cooldownEndsAtMs = 0
	globalClaimState.roundClaimedCardIds.clear()
	globalClaimState.roundClaimedUserIds.clear()
	globalClaimState.roundCards = []
	globalClaimState.activeUsers.clear()
}
