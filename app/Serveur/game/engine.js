// Moteur de règles du combat : fonctions pures, sans base de données ni socket.
// Chaque action mute l'objet `game` et renvoie { ok: true, events } ou { ok: false, error }.
// Les événements servent au client pour jouer les animations et remplir le journal.
// Sur le terrain, `damage` est l'attaque courante et `health` les PV max (les bonus les modifient).

import { CAPACITES_CIBLEES, aCapacite, niveauCapacite } from "./capacites.js"

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
    opponentProtected: "Tu dois d'abord éliminer les créatures adverses.",
    tauntBlocks: "Tu dois d'abord attaquer une créature avec Provocation.",
    flyerBlocks: "Une créature avec Vol protège le joueur adverse.",
    abilityTarget: "Choisis une cible valide pour la capacité de cette carte.",
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

// Créatures que peut viser une capacité ciblée (Inspiration : mes créatures, Intimidation : les adverses)
function abilityTargets(game, userId, id) {
    const side = CAPACITES_CIBLEES[id] === "allie" ? userId : opponentOf(game, userId)
    return game.players[side].board
}

// `cibles` = { inspiration: instanceId, intimidation: instanceId } ; une cible est exigée seulement
// si la carte a la capacité et qu'au moins une créature peut être visée (sinon la capacité ne fait rien).
export function playCard(game, userId, instanceId, cibles = {}) {
    const turnError = checkTurn(game, userId)
    if (turnError) return fail(turnError)
    const player = game.players[userId]
    const index = player.hand.findIndex((c) => c.instanceId === instanceId)
    if (index === -1) return fail(ERRORS.cardNotFound)
    const card = player.hand[index]
    if (card.mana > player.mana) return fail(ERRORS.notEnoughMana)
    if (player.board.length >= RULES.MAX_BOARD) return fail(ERRORS.boardFull)
    const targets = {}
    for (const id of Object.keys(CAPACITES_CIBLEES)) {
        if (!aCapacite(card, id)) continue
        const candidates = abilityTargets(game, userId, id)
        if (candidates.length === 0) continue
        targets[id] = candidates.find((c) => c.instanceId === cibles?.[id])
        if (!targets[id]) return fail(ERRORS.abilityTarget)
    }

    player.mana -= card.mana
    player.hand.splice(index, 1)
    const creature = { ...card, currentHp: card.health, canAttack: aCapacite(card, "haste"), bouclier: niveauCapacite(card, "bouclier") }
    player.board.push(creature)
    const events = [{ type: "play", playerId: userId, card: creature }]
    resolveOnPlay(game, userId, creature, targets, events)
    return { ok: true, events }
}

// Inflige des dégâts à une créature ; renvoie les dégâts réellement infligés (0 si son bouclier les bloque)
function damageCreature(ownerId, creature, amount, events) {
    if (amount <= 0) return 0
    if (creature.bouclier > 0) {
        creature.bouclier -= 1
        events.push({ type: "shield", playerId: ownerId, instanceId: creature.instanceId, remaining: creature.bouclier })
        return 0
    }
    creature.currentHp -= amount
    events.push({ type: "damage", playerId: ownerId, targetType: "card", instanceId: creature.instanceId, amount })
    return amount
}

function healPlayer(game, userId, amount, events) {
    const player = game.players[userId]
    const healed = Math.min(amount, RULES.PLAYER_HP - player.hp)
    if (healed <= 0) return
    player.hp += healed
    events.push({ type: "heal", playerId: userId, targetType: "player", amount: healed })
}

// Coup porté au combat par `source` (Toxique, Drain de vie)
function strikeCreature(game, sourceOwnerId, source, targetOwnerId, target, events) {
    const dealt = damageCreature(targetOwnerId, target, source.damage, events)
    if (dealt > 0 && aCapacite(source, "toxique")) target.currentHp = Math.min(target.currentHp, 0)
    if (aCapacite(source, "drain_de_vie")) healPlayer(game, sourceOwnerId, dealt, events)
}

// Retire les créatures mortes, dans l'ordre des joueurs donné
function removeDead(game, ownerIds, events) {
    for (const ownerId of ownerIds) {
        const player = game.players[ownerId]
        for (const creature of player.board.filter((c) => c.currentHp <= 0)) {
            events.push({ type: "death", playerId: ownerId, instanceId: creature.instanceId, nom_carte: creature.nom_carte })
        }
        player.board = player.board.filter((c) => c.currentHp > 0)
    }
}

// ---------- Capacités résolues quand la carte est jouée ----------

// +X/+X (ou -X/-X) : l'attaque ne descend pas sous 0 ; une créature dont les PV tombent à 0 meurt
function modifyStats(ownerId, creature, delta, events) {
    creature.damage = Math.max(0, creature.damage + delta)
    creature.health += delta
    creature.currentHp += delta
    events.push({
        type: "buff", playerId: ownerId, instanceId: creature.instanceId,
        damage: creature.damage, health: creature.health, currentHp: creature.currentHp,
    })
}

function resolveOnPlay(game, userId, creature, targets, events) {
    const opponentId = opponentOf(game, userId)
    const allies = game.players[userId].board.filter((c) => c !== creature)
    const enemies = game.players[opponentId].board
    const steps = [
        ["inspiration", (n) => targets.inspiration && modifyStats(userId, targets.inspiration, n, events)],
        ["ralliement", (n) => allies.forEach((c) => modifyStats(userId, c, n, events))],
        ["intimidation", (n) => targets.intimidation && modifyStats(opponentId, targets.intimidation, -n, events)],
        ["intimidation_de_masse", (n) => enemies.forEach((c) => modifyStats(opponentId, c, -n, events))],
        ["pioche", (n) => { for (let i = 0; i < n && game.winnerId === null; i++) draw(game, userId, events) }],
    ]
    for (const [id, apply] of steps) {
        const niveau = niveauCapacite(creature, id)
        if (niveau === 0 || game.winnerId !== null) continue
        events.push({ type: "ability", playerId: userId, instanceId: creature.instanceId, nom_carte: creature.nom_carte, capacite: id, niveau })
        apply(niveau)
    }
    removeDead(game, [opponentId], events)
}

export function attack(game, userId, attackerInstanceId, target) {
    const turnError = checkTurn(game, userId)
    if (turnError) return fail(turnError)
    const player = game.players[userId]
    const opponentId = opponentOf(game, userId)
    const opponent = game.players[opponentId]
    const attacker = player.board.find((c) => c.instanceId === attackerInstanceId)
    if (!attacker?.canAttack) return fail(ERRORS.cannotAttack)
    // Provocation l'emporte sur tout, même sur Vol
    const opponentHasTaunt = opponent.board.some((c) => aCapacite(c, "provocation"))

    const events = []
    if (target?.type === "player") {
        if (opponentHasTaunt) return fail(ERRORS.tauntBlocks)
        // Le joueur adverse est protégé par ses créatures ; Vol ignore les créatures terrestres, pas celles avec Vol
        if (aCapacite(attacker, "vol")) {
            if (opponent.board.some((c) => aCapacite(c, "vol"))) return fail(ERRORS.flyerBlocks)
        } else if (opponent.board.length > 0) {
            return fail(ERRORS.opponentProtected)
        }
        attacker.canAttack = false
        events.push({ type: "attack", playerId: userId, attackerId: attacker.instanceId, target: { type: "player" } })
        opponent.hp = Math.max(0, opponent.hp - attacker.damage)
        events.push({ type: "damage", playerId: opponentId, targetType: "player", amount: attacker.damage })
        if (aCapacite(attacker, "drain_de_vie")) healPlayer(game, userId, attacker.damage, events)
        if (opponent.hp === 0) finish(game, userId, "combat", events)
        return { ok: true, events }
    }

    const defender = target?.type === "card"
        ? opponent.board.find((c) => c.instanceId === target.instanceId)
        : null
    if (!defender) return fail(ERRORS.invalidTarget)
    if (opponentHasTaunt && !aCapacite(defender, "provocation")) return fail(ERRORS.tauntBlocks)

    attacker.canAttack = false
    events.push({ type: "attack", playerId: userId, attackerId: attacker.instanceId, target: { type: "card", instanceId: defender.instanceId } })
    strikeCreature(game, userId, attacker, opponentId, defender, events)
    strikeCreature(game, opponentId, defender, userId, attacker, events)
    removeDead(game, [opponentId, userId], events)
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
