// Moteur de règles du combat : fonctions pures, sans base de données ni socket.
// Chaque action mute l'objet `game` et renvoie { ok: true, events } ou { ok: false, error }.
// Les événements servent au client pour jouer les animations et remplir le journal.

export const RULES = {
    PLAYER_HP: 50,
    DECK_SIZE: 50,
    MAX_MANA: 10,
    START_HAND_FIRST: 3,
    START_HAND_SECOND: 4,
    MAX_HAND: 10,
    MAX_BOARD: 7,
    TURN_SECONDS: 75,
    TURN_WARNING_SECONDS: 15,
}

const ERRORS = {
    gameOver: "La partie est terminée.",
    notYourTurn: "Ce n'est pas ton tour.",
    cardNotFound: "Carte introuvable.",
    notEnoughMana: "Pas assez de mana.",
    boardFull: "Ton terrain est plein (7 créatures max).",
    cannotAttack: "Cette créature ne peut pas attaquer.",
    invalidTarget: "Cible invalide.",
}

function fail(error) {
    return { ok: false, error }
}

function shuffle(array, rng) {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

function opponentOf(game, userId) {
    return game.order.find((id) => id !== userId)
}

function finish(game, winnerId, reason, events) {
    game.winnerId = winnerId
    game.endReason = reason
    events.push({ type: "gameover", winnerId, loserId: opponentOf(game, winnerId), reason })
}

// Pioche une carte : brûlée si la main est pleine, défaite (fatigue) si le deck est vide
function draw(game, userId, events) {
    const player = game.players[userId]
    if (player.deck.length === 0) {
        finish(game, opponentOf(game, userId), "fatigue", events)
        return
    }
    const card = player.deck.shift()
    if (player.hand.length >= RULES.MAX_HAND) {
        events.push({ type: "burn", playerId: userId, card })
        return
    }
    player.hand.push(card)
    events.push({ type: "draw", playerId: userId, card })
}

function startTurn(game, userId, now, events) {
    const player = game.players[userId]
    game.currentPlayerId = userId
    game.turnEndsAt = now + RULES.TURN_SECONDS * 1000
    player.turnCount += 1
    player.maxMana = Math.min(RULES.MAX_MANA, player.turnCount)
    player.mana = player.maxMana
    player.board.forEach((card) => { card.canAttack = true })
    events.push({ type: "turn", playerId: userId, turn: game.turn })
    draw(game, userId, events)
}

// Vérifications communes à toutes les actions d'un joueur
function checkTurn(game, userId) {
    if (game.winnerId !== null) return ERRORS.gameOver
    if (game.currentPlayerId !== userId) return ERRORS.notYourTurn
    return null
}

export function createGame({ playerIds, decks, firstPlayerId, now = Date.now(), rng = Math.random }) {
    const secondPlayerId = playerIds.find((id) => id !== firstPlayerId)
    const game = {
        order: [firstPlayerId, secondPlayerId],
        turn: 1,
        currentPlayerId: firstPlayerId,
        turnEndsAt: null,
        winnerId: null,
        endReason: null,
        players: {},
    }
    const events = []
    for (const userId of game.order) {
        game.players[userId] = {
            hp: RULES.PLAYER_HP,
            mana: 0,
            maxMana: 0,
            turnCount: 0,
            deck: shuffle(decks[userId], rng),
            hand: [],
            board: [],
        }
        const handSize = userId === firstPlayerId ? RULES.START_HAND_FIRST : RULES.START_HAND_SECOND
        for (let i = 0; i < handSize; i++) draw(game, userId, events)
    }
    startTurn(game, firstPlayerId, now, events)
    return { game, events }
}

export function playCard(game, userId, instanceId) {
    const turnError = checkTurn(game, userId)
    if (turnError) return fail(turnError)
    const player = game.players[userId]
    const index = player.hand.findIndex((c) => c.instanceId === instanceId)
    if (index === -1) return fail(ERRORS.cardNotFound)
    const card = player.hand[index]
    if (card.mana > player.mana) return fail(ERRORS.notEnoughMana)
    if (player.board.length >= RULES.MAX_BOARD) return fail(ERRORS.boardFull)

    player.mana -= card.mana
    player.hand.splice(index, 1)
    const creature = { ...card, currentHp: card.health, canAttack: false }
    player.board.push(creature)
    return { ok: true, events: [{ type: "play", playerId: userId, card: creature }] }
}

function damageCreature(ownerId, creature, amount, events) {
    creature.currentHp -= amount
    events.push({ type: "damage", playerId: ownerId, targetType: "card", instanceId: creature.instanceId, amount })
}

function removeDead(game, ownerId, events) {
    const player = game.players[ownerId]
    for (const creature of player.board.filter((c) => c.currentHp <= 0)) {
        events.push({ type: "death", playerId: ownerId, instanceId: creature.instanceId, nom_carte: creature.nom_carte })
    }
    player.board = player.board.filter((c) => c.currentHp > 0)
}

export function attack(game, userId, attackerInstanceId, target) {
    const turnError = checkTurn(game, userId)
    if (turnError) return fail(turnError)
    const player = game.players[userId]
    const opponentId = opponentOf(game, userId)
    const opponent = game.players[opponentId]
    const attacker = player.board.find((c) => c.instanceId === attackerInstanceId)
    if (!attacker?.canAttack) return fail(ERRORS.cannotAttack)

    const events = []
    if (target?.type === "player") {
        attacker.canAttack = false
        events.push({ type: "attack", playerId: userId, attackerId: attacker.instanceId, target: { type: "player" } })
        opponent.hp = Math.max(0, opponent.hp - attacker.damage)
        events.push({ type: "damage", playerId: opponentId, targetType: "player", amount: attacker.damage })
        if (opponent.hp === 0) finish(game, userId, "combat", events)
        return { ok: true, events }
    }

    const defender = target?.type === "card"
        ? opponent.board.find((c) => c.instanceId === target.instanceId)
        : null
    if (!defender) return fail(ERRORS.invalidTarget)

    attacker.canAttack = false
    events.push({ type: "attack", playerId: userId, attackerId: attacker.instanceId, target: { type: "card", instanceId: defender.instanceId } })
    damageCreature(opponentId, defender, attacker.damage, events)
    damageCreature(userId, attacker, defender.damage, events)
    removeDead(game, opponentId, events)
    removeDead(game, userId, events)
    return { ok: true, events }
}

export function endTurn(game, userId, now = Date.now()) {
    const turnError = checkTurn(game, userId)
    if (turnError) return fail(turnError)
    const events = []
    game.turn += 1
    startTurn(game, opponentOf(game, userId), now, events)
    return { ok: true, events }
}

export function concede(game, userId, reason) {
    if (game.winnerId !== null) return fail(ERRORS.gameOver)
    const events = []
    finish(game, opponentOf(game, userId), reason, events)
    return { ok: true, events }
}

export function viewFor(game, userId) {
    const me = game.players[userId]
    const opponentId = opponentOf(game, userId)
    const opponent = game.players[opponentId]
    return {
        turn: game.turn,
        currentPlayerId: game.currentPlayerId,
        isMyTurn: game.currentPlayerId === userId,
        turnEndsAt: game.turnEndsAt,
        winnerId: game.winnerId,
        me: {
            userId,
            hp: me.hp,
            mana: me.mana,
            maxMana: me.maxMana,
            hand: me.hand,
            board: me.board,
            deckCount: me.deck.length,
        },
        opponent: {
            userId: opponentId,
            hp: opponent.hp,
            mana: opponent.mana,
            maxMana: opponent.maxMana,
            handCount: opponent.hand.length,
            board: opponent.board,
            deckCount: opponent.deck.length,
        },
    }
}

// Retire la carte des pioches adverses : le client ne doit jamais connaître la main de l'autre
export function redactEventsFor(events, userId) {
    return events.map((event) => {
        if ((event.type === "draw" || event.type === "burn") && event.playerId !== userId) {
            const { card: _hidden, ...rest } = event
            return rest
        }
        return event
    })
}
