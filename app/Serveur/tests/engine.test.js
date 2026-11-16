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
