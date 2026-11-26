import assert from "node:assert/strict"
import { test } from "node:test"
import {
    RULES,
    attack,
    concede,
    createGame,
    endTurn,
    playCard,
    redactEventsFor,
    viewFor,
} from "../game/engine.js"

const A = 1
const B = 2

// Crée n cartes identiques pour un joueur (instanceId uniques)
function makeDeck(userId, n = 50, { mana = 1, health = 3, damage = 2 } = {}) {
    return Array.from({ length: n }, (_, i) => ({
        instanceId: `${userId}-c-${i}`,
        id_carte: 1,
        nom_carte: `Carte ${i}`,
        image: "img.png",
        description: "",
        rarete: 1,
        mana,
        health,
        damage,
    }))
}

function newGame(options = {}) {
    return createGame({
        playerIds: [A, B],
        decks: { [A]: makeDeck(A, 50, options.statsA), [B]: makeDeck(B, 50, options.statsB) },
        firstPlayerId: A,
        now: 0,
        rng: () => 0,
    })
}

// Fait passer des tours jusqu'à ce que ce soit de nouveau le tour de userId
function passUntil(game, userId) {
    do {
        endTurn(game, game.currentPlayerId, 0)
    } while (game.currentPlayerId !== userId)
}

test("createGame deals 3 to first and 4 to second, first starts turn 1 with 1 mana and draws", () => {
    const { game, events } = newGame()
    const a = game.players[A]
    const b = game.players[B]
    assert.equal(game.currentPlayerId, A)
    assert.equal(game.turn, 1)
    assert.equal(a.hand.length, 4)
    assert.equal(b.hand.length, 4)
    assert.equal(a.maxMana, 1)
    assert.equal(a.mana, 1)
    assert.equal(a.hp, RULES.PLAYER_HP)
    assert.equal(b.hp, 50)
    assert.equal(a.deck.length, 46)
    assert.equal(b.deck.length, 46)
    assert.equal(game.turnEndsAt, RULES.TURN_SECONDS * 1000)
    assert.ok(events.some((e) => e.type === "turn" && e.playerId === A))
})

test("mana grows with each own turn and caps at 10", () => {
    const { game } = newGame()
    endTurn(game, A, 0)
    assert.equal(game.players[B].maxMana, 1)
    endTurn(game, B, 0)
    assert.equal(game.players[A].maxMana, 2)
    for (let i = 0; i < 22; i++) endTurn(game, game.currentPlayerId, 0)
    const current = game.players[game.currentPlayerId]
    assert.equal(current.maxMana, RULES.MAX_MANA)
    assert.equal(current.mana, 10)
})

test("playCard spends mana and puts creature on board without canAttack", () => {
    const { game } = newGame()
    const card = game.players[A].hand[0]
    const result = playCard(game, A, card.instanceId)
    assert.equal(result.ok, true)
    assert.equal(game.players[A].mana, 0)
    assert.equal(game.players[A].hand.length, 3)
    assert.equal(game.players[A].board.length, 1)
    assert.equal(game.players[A].board[0].currentHp, card.health)
    assert.equal(game.players[A].board[0].canAttack, false)
    assert.ok(result.events.some((e) => e.type === "play" && e.card.instanceId === card.instanceId))
})

test("playCard rejects not enough mana", () => {
    const { game } = newGame({ statsA: { mana: 2, health: 3, damage: 2 } })
    const card = game.players[A].hand[0]
    const result = playCard(game, A, card.instanceId)
    assert.deepEqual(result, { ok: false, error: "Pas assez de mana." })
    assert.equal(game.players[A].hand.length, 4)
    assert.equal(game.players[A].mana, 1)
})

test("playCard rejects unknown card", () => {
    const { game } = newGame()
    assert.deepEqual(playCard(game, A, "nope"), { ok: false, error: "Carte introuvable." })
})

test("board full keeps card and mana", () => {
    const { game } = newGame({ statsA: { mana: 0, health: 3, damage: 2 } })
    const a = game.players[A]
    a.hand.push(...a.deck.splice(0, 6))
    for (let i = 0; i < RULES.MAX_BOARD; i++) {
        assert.equal(playCard(game, A, a.hand[0].instanceId).ok, true)
    }
    const handBefore = a.hand.length
    const result = playCard(game, A, a.hand[0].instanceId)
    assert.deepEqual(result, { ok: false, error: "Ton terrain est plein (7 créatures max)." })
    assert.equal(a.hand.length, handBefore)
    assert.equal(a.board.length, 7)
    assert.equal(a.mana, 1)
})

test("rejects out of turn", () => {
    const { game } = newGame()
    const bCard = game.players[B].hand[0]
    const err = { ok: false, error: "Ce n'est pas ton tour." }
    assert.deepEqual(playCard(game, B, bCard.instanceId), err)
    assert.deepEqual(attack(game, B, bCard.instanceId, { type: "player" }), err)
    assert.deepEqual(endTurn(game, B, 0), err)
    assert.equal(game.currentPlayerId, A)
})

test("creature cannot attack the turn it is played", () => {
    const { game } = newGame()
    const card = game.players[A].hand[0]
    playCard(game, A, card.instanceId)
    assert.deepEqual(
        attack(game, A, card.instanceId, { type: "player" }),
        { ok: false, error: "Cette créature ne peut pas attaquer." }
    )
})

test("creature can attack next own turn", () => {
    const { game } = newGame()
    const card = game.players[A].hand[0]
    playCard(game, A, card.instanceId)
    passUntil(game, A)
    const result = attack(game, A, card.instanceId, { type: "player" })
    assert.equal(result.ok, true)
    assert.equal(game.players[B].hp, 48)
    assert.ok(result.events.some((e) => e.type === "damage" && e.targetType === "player" && e.playerId === B && e.amount === 2))
})

test("creature attacks once per turn", () => {
    const { game } = newGame()
    const card = game.players[A].hand[0]
    playCard(game, A, card.instanceId)
    passUntil(game, A)
    assert.equal(attack(game, A, card.instanceId, { type: "player" }).ok, true)
    assert.deepEqual(
        attack(game, A, card.instanceId, { type: "player" }),
        { ok: false, error: "Cette créature ne peut pas attaquer." }
    )
    assert.equal(game.players[B].hp, 48)
})

test("combat damage is simultaneous and kills both at 0", () => {
    const stats = { mana: 1, health: 3, damage: 3 }
    const { game } = newGame({ statsA: stats, statsB: stats })
    const aCard = game.players[A].hand[0]
    playCard(game, A, aCard.instanceId)
    endTurn(game, A, 0)
    const bCard = game.players[B].hand[0]
    playCard(game, B, bCard.instanceId)
    endTurn(game, B, 0)
    const result = attack(game, A, aCard.instanceId, { type: "card", instanceId: bCard.instanceId })
    assert.equal(result.ok, true)
    assert.equal(result.events.filter((e) => e.type === "death").length, 2)
    assert.equal(game.players[A].board.length, 0)
    assert.equal(game.players[B].board.length, 0)
})

test("damaged creature keeps reduced hp", () => {
    const { game } = newGame({ statsA: { mana: 1, health: 5, damage: 1 }, statsB: { mana: 1, health: 5, damage: 2 } })
    const aCard = game.players[A].hand[0]
    playCard(game, A, aCard.instanceId)
    endTurn(game, A, 0)
    const bCard = game.players[B].hand[0]
    playCard(game, B, bCard.instanceId)
    endTurn(game, B, 0)
    attack(game, A, aCard.instanceId, { type: "card", instanceId: bCard.instanceId })
    assert.equal(game.players[A].board[0].currentHp, 3)
    assert.equal(game.players[B].board[0].currentHp, 4)
})

test("attack on player reduces hp and ends game at 0", () => {
    const { game } = newGame()
    const card = game.players[A].hand[0]
    playCard(game, A, card.instanceId)
    passUntil(game, A)
    game.players[B].hp = 1
    const result = attack(game, A, card.instanceId, { type: "player" })
    assert.equal(result.ok, true)
    assert.equal(game.players[B].hp, 0)
    assert.equal(game.winnerId, A)
    assert.equal(game.endReason, "combat")
    assert.ok(result.events.some((e) => e.type === "gameover" && e.winnerId === A && e.loserId === B && e.reason === "combat"))
})

test("invalid target", () => {
    const { game } = newGame()
    const card = game.players[A].hand[0]
    playCard(game, A, card.instanceId)
    passUntil(game, A)
    assert.deepEqual(
        attack(game, A, card.instanceId, { type: "card", instanceId: "ghost" }),
        { ok: false, error: "Cible invalide." }
    )
    assert.deepEqual(attack(game, A, card.instanceId, { type: "banane" }), { ok: false, error: "Cible invalide." })
    assert.equal(game.players[A].board[0].canAttack, true)
})

test("burns card when hand is full", () => {
    const { game } = newGame()
    const b = game.players[B]
    b.hand.push(...b.deck.splice(0, RULES.MAX_HAND - b.hand.length))
    const deckBefore = b.deck.length
    const result = endTurn(game, A, 0)
    assert.equal(b.hand.length, RULES.MAX_HAND)
    assert.equal(b.deck.length, deckBefore - 1)
    assert.ok(result.events.some((e) => e.type === "burn" && e.playerId === B && e.card))
})

test("drawing from empty deck loses by fatigue", () => {
    const { game } = newGame()
    game.players[B].deck = []
    const result = endTurn(game, A, 0)
    assert.equal(result.ok, true)
    assert.equal(game.winnerId, A)
    assert.equal(game.endReason, "fatigue")
    assert.ok(result.events.some((e) => e.type === "gameover" && e.reason === "fatigue" && e.loserId === B))
})

test("rejects actions after game over", () => {
    const { game } = newGame()
    concede(game, B, "leave")
    const err = { ok: false, error: "La partie est terminée." }
    assert.deepEqual(playCard(game, A, game.players[A].hand[0].instanceId), err)
    assert.deepEqual(attack(game, A, "x", { type: "player" }), err)
    assert.deepEqual(endTurn(game, A, 0), err)
    assert.deepEqual(concede(game, A, "leave"), err)
})

test("concede sets winner to opponent with reason", () => {
    const { game } = newGame()
    const result = concede(game, A, "disconnect")
    assert.equal(result.ok, true)
    assert.equal(game.winnerId, B)
    assert.equal(game.endReason, "disconnect")
    assert.ok(result.events.some((e) => e.type === "gameover" && e.loserId === A && e.reason === "disconnect"))
})

test("endTurn sets next turn deadline", () => {
    const { game } = newGame()
    endTurn(game, A, 1000)
    assert.equal(game.turnEndsAt, 1000 + RULES.TURN_SECONDS * 1000)
    assert.equal(game.turn, 2)
})

test("viewFor hides opponent hand and deck", () => {
    const { game } = newGame()
    const view = viewFor(game, B)
    assert.equal(view.isMyTurn, false)
    assert.equal(view.me.userId, B)
    assert.equal(view.me.hand.length, 4)
    assert.equal(view.me.deckCount, 46)
    assert.equal(view.opponent.userId, A)
    assert.equal(view.opponent.handCount, 4)
    assert.equal(view.opponent.hand, undefined)
    assert.equal(view.opponent.deck, undefined)
    assert.equal(view.me.deck, undefined)
})

test("redactEventsFor strips opponent drawn card", () => {
    const { events } = newGame()
    const forB = redactEventsFor(events, B)
    const forA = redactEventsFor(events, A)
    const drawB = forB.find((e) => e.type === "draw" && e.playerId === A)
    const drawA = forA.find((e) => e.type === "draw" && e.playerId === A)
    assert.equal(drawB.card, undefined)
    assert.ok(drawA.card)
})

test("cannot attack the player while they have a creature on board", () => {
    const { game } = newGame()
    const aCard = game.players[A].hand[0]
    playCard(game, A, aCard.instanceId)
    endTurn(game, A, 0)
    const bCard = game.players[B].hand[0]
    playCard(game, B, bCard.instanceId)
    endTurn(game, B, 0)
    assert.deepEqual(
        attack(game, A, aCard.instanceId, { type: "player" }),
        { ok: false, error: "Tu dois d'abord éliminer les créatures adverses." }
    )
    assert.equal(game.players[B].hp, RULES.PLAYER_HP)
    assert.equal(game.players[A].board[0].canAttack, true)
})


// ---------- Capacités ----------

// Joue la première carte de la main de userId avec les capacités/stats données ; renvoie la créature posée
function playWith(game, userId, capacites = {}, stats = {}, cibles = {}) {
    return playWithEvents(game, userId, capacites, stats, cibles).creature
}

// Comme playWith, mais renvoie aussi les événements du jeu de la carte
function playWithEvents(game, userId, capacites = {}, stats = {}, cibles = {}) {
    const player = game.players[userId]
    const card = player.hand[0]
    Object.assign(card, stats, { capacites })
    player.mana = 10
    const result = playCard(game, userId, card.instanceId, cibles)
    assert.equal(result.ok, true, result.error)
    return { creature: player.board.find((c) => c.instanceId === card.instanceId), events: result.events }
}

// A pose `attacker`, B pose les créatures `defenders`, puis c'est de nouveau le tour de A
function setupCombat(attackerAbilities, attackerStats, defenders = []) {
    const { game } = newGame()
    const attacker = playWith(game, A, attackerAbilities, attackerStats)
    endTurn(game, A, 0)
    const placed = defenders.map(([abilities, stats]) => playWith(game, B, abilities, stats))
    endTurn(game, B, 0)
    return { game, attacker, defenders: placed }
}

const TAUNT_ERROR = { ok: false, error: "Tu dois d'abord attaquer une créature avec Provocation." }
const TARGET_ERROR = { ok: false, error: "Choisis une cible valide pour la capacité de cette carte." }

test("haste attacks the turn it is played", () => {
    const { game } = newGame()
    const card = playWith(game, A, { haste: true })
    assert.equal(card.canAttack, true)
    assert.equal(attack(game, A, card.instanceId, { type: "player" }).ok, true)
})

test("taunt must be attacked first", () => {
    const { game, attacker, defenders: [normal, taunt] } = setupCombat({}, {}, [[{}], [{ provocation: true }]])
    assert.deepEqual(attack(game, A, attacker.instanceId, { type: "card", instanceId: normal.instanceId }), TAUNT_ERROR)
    assert.equal(attack(game, A, attacker.instanceId, { type: "card", instanceId: taunt.instanceId }).ok, true)
})

test("vol ignores ground creatures to attack the player", () => {
    const { game, attacker } = setupCombat({ vol: true }, {}, [[{}]])
    assert.equal(attack(game, A, attacker.instanceId, { type: "player" }).ok, true)
    assert.equal(game.players[B].hp, RULES.PLAYER_HP - 2)
})

test("vol is blocked by an enemy creature with vol", () => {
    const { game, attacker } = setupCombat({ vol: true }, {}, [[{ vol: true }]])
    assert.deepEqual(
        attack(game, A, attacker.instanceId, { type: "player" }),
        { ok: false, error: "Une créature avec Vol protège le joueur adverse." }
    )
    assert.equal(attacker.canAttack, true)
})

test("taunt blocks attacks on player even with vol", () => {
    const { game, attacker } = setupCombat({ vol: true }, {}, [[{ provocation: true }]])
    assert.deepEqual(attack(game, A, attacker.instanceId, { type: "player" }), TAUNT_ERROR)
    assert.equal(game.players[B].hp, RULES.PLAYER_HP)
})

test("bouclier X blocks the next X damage instances", () => {
    const { game, attacker, defenders: [shielded] } = setupCombat(
        {}, { damage: 2, health: 20 }, [[{ bouclier: 2 }, { health: 10, damage: 0 }]]
    )
    const result = attack(game, A, attacker.instanceId, { type: "card", instanceId: shielded.instanceId })
    assert.ok(result.events.some((e) => e.type === "shield" && e.instanceId === shielded.instanceId && e.remaining === 1))
    passUntil(game, A)
    attack(game, A, attacker.instanceId, { type: "card", instanceId: shielded.instanceId })
    assert.equal(shielded.currentHp, 10)
    assert.equal(shielded.bouclier, 0)
    passUntil(game, A)
    attack(game, A, attacker.instanceId, { type: "card", instanceId: shielded.instanceId })
    assert.equal(shielded.currentHp, 8)
})

test("toxique kills damaged creature", () => {
    const { game, attacker, defenders: [big] } = setupCombat({ toxique: true }, { damage: 1, health: 20 }, [[{}, { health: 10, damage: 1 }]])
    attack(game, A, attacker.instanceId, { type: "card", instanceId: big.instanceId })
    assert.equal(game.players[B].board.length, 0)
})

test("toxique is blocked by bouclier", () => {
    const { game, attacker, defenders: [shielded] } = setupCombat(
        { toxique: true }, { damage: 1, health: 20 }, [[{ bouclier: 1 }, { health: 10, damage: 1 }]]
    )
    attack(game, A, attacker.instanceId, { type: "card", instanceId: shielded.instanceId })
    assert.equal(game.players[B].board.length, 1)
})

test("toxique works on retaliation", () => {
    const { game, attacker, defenders: [toxic] } = setupCombat({}, { damage: 1, health: 20 }, [[{ toxique: true }, { health: 10, damage: 1 }]])
    attack(game, A, attacker.instanceId, { type: "card", instanceId: toxic.instanceId })
    assert.equal(game.players[A].board.length, 0)
})

test("drain de vie heals owner by damage dealt, capped at max", () => {
    const { game, attacker, defenders: [target] } = setupCombat(
        { drain_de_vie: true }, { damage: 8, health: 30 }, [[{}, { health: 30, damage: 0 }]]
    )
    game.players[A].hp = 45
    const result = attack(game, A, attacker.instanceId, { type: "card", instanceId: target.instanceId })
    assert.equal(game.players[A].hp, RULES.PLAYER_HP)
    assert.ok(result.events.some((e) => e.type === "heal" && e.playerId === A && e.targetType === "player"))
})

test("drain de vie gains nothing when a bouclier blocks", () => {
    const { game, attacker, defenders: [shielded] } = setupCombat(
        { drain_de_vie: true }, { damage: 5, health: 30 }, [[{ bouclier: 1 }, { health: 30, damage: 0 }]]
    )
    game.players[A].hp = 40
    attack(game, A, attacker.instanceId, { type: "card", instanceId: shielded.instanceId })
    assert.equal(game.players[A].hp, 40)
})

test("inspiration gives +X/+X to the chosen ally", () => {
    const { game } = newGame()
    const first = playWith(game, A, {}, { damage: 2, health: 3 })
    const second = playWith(game, A, {}, { damage: 2, health: 3 })
    const { creature, events } = playWithEvents(game, A, { inspiration: 3 }, {}, { inspiration: second.instanceId })
    assert.equal(second.damage, 5)
    assert.equal(second.health, 6)
    assert.equal(second.currentHp, 6)
    assert.equal(first.damage, 2)
    assert.equal(creature.damage, 2)
    assert.ok(events.some((e) => e.type === "ability" && e.capacite === "inspiration" && e.niveau === 3))
})

test("inspiration requires a valid ally target when one exists", () => {
    const { game } = newGame()
    playWith(game, A)
    const card = game.players[A].hand[0]
    card.capacites = { inspiration: 1 }
    game.players[A].mana = 10
    assert.deepEqual(playCard(game, A, card.instanceId), TARGET_ERROR)
    assert.deepEqual(playCard(game, A, card.instanceId, { inspiration: card.instanceId }), TARGET_ERROR)
    assert.equal(game.players[A].hand.includes(card), true)
    assert.equal(game.players[A].mana, 10)
})

test("targeted abilities do nothing without a possible target", () => {
    const { game } = newGame()
    const { events } = playWithEvents(game, A, { inspiration: 2, intimidation: 2 })
    assert.equal(game.players[A].board.length, 1)
    assert.ok(!events.some((e) => e.type === "buff"))
})

test("ralliement buffs the other allies only", () => {
    const { game } = newGame()
    const other = playWith(game, A, {}, { damage: 2, health: 3 })
    const creature = playWith(game, A, { ralliement: 2 }, { damage: 1, health: 1 })
    assert.equal(other.damage, 4)
    assert.equal(other.health, 5)
    assert.equal(creature.damage, 1)
    assert.equal(creature.health, 1)
})

test("intimidation gives -X/-X to the chosen enemy and can kill it", () => {
    const { game } = newGame()
    endTurn(game, A, 0)
    const weak = playWith(game, B, {}, { damage: 2, health: 2 })
    const strong = playWith(game, B, {}, { damage: 3, health: 6 })
    endTurn(game, B, 0)
    playWith(game, A, { intimidation: 2 }, {}, { intimidation: strong.instanceId })
    assert.equal(strong.damage, 1)
    assert.equal(strong.health, 4)
    assert.equal(strong.currentHp, 4)
    playWith(game, A, { intimidation: 2 }, {}, { intimidation: weak.instanceId })
    assert.deepEqual(game.players[B].board, [strong])
})

test("intimidation targets only enemy creatures", () => {
    const { game } = newGame()
    const mine = playWith(game, A)
    endTurn(game, A, 0)
    playWith(game, B)
    endTurn(game, B, 0)
    const card = game.players[A].hand[0]
    card.capacites = { intimidation: 1 }
    game.players[A].mana = 10
    assert.deepEqual(playCard(game, A, card.instanceId, { intimidation: mine.instanceId }), TARGET_ERROR)
})

test("intimidation de masse hits every enemy and attack never goes below 0", () => {
    const { game } = newGame()
    endTurn(game, A, 0)
    const small = playWith(game, B, {}, { damage: 1, health: 2 })
    const big = playWith(game, B, {}, { damage: 1, health: 6 })
    endTurn(game, B, 0)
    const { events } = playWithEvents(game, A, { intimidation_de_masse: 2 })
    assert.deepEqual(game.players[B].board, [big])
    assert.equal(big.damage, 0)
    assert.equal(big.currentHp, 4)
    assert.ok(events.some((e) => e.type === "death" && e.instanceId === small.instanceId))
})

test("pioche draws X cards when played", () => {
    const { game } = newGame()
    const before = game.players[A].hand.length
    playWith(game, A, { pioche: 2 })
    assert.equal(game.players[A].hand.length, before - 1 + 2)
})

test("pioche on empty deck causes fatigue", () => {
    const { game } = newGame()
    game.players[A].deck = []
    playWith(game, A, { pioche: 1 })
    assert.equal(game.winnerId, B)
    assert.equal(game.endReason, "fatigue")
})
