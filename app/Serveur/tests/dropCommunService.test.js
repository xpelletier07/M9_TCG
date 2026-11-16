import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { pool } from '../db/pool.js'
import {
  getDropCommunState,
  getOrCreateRoundCards,
  globalClaimState,
  registerClaimedCard,
  resetGlobalDropStateForTesting,
  setDropCommunIo,
} from '../services/dropCommunService.js'

const originalQuery = pool.query
const cards = [1, 2, 3].map(id_carte => ({ id_carte, rarete: 1 }))

afterEach(() => {
  resetGlobalDropStateForTesting()
  setDropCommunIo(null)
  pool.query = originalQuery
})

async function openRound(t) {
  resetGlobalDropStateForTesting()
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000000 })
  pool.query = async () => ({ rows: cards })
  await getDropCommunState()
}

test('Un round sans réclamation ferme après 2 minutes et lance 5 minutes de cooldown', async t => {
  await openRound(t)
  let broadcasts = 0
  const openedState = await getDropCommunState()
  assert.equal(openedState.claimRemainingSeconds, 120)
  assert.equal(Date.parse(openedState.claimClosesAt), Date.now() + 120000)
  setDropCommunIo({ emit: () => { broadcasts += 1 } })
  t.mock.timers.tick(119000)
  assert.equal((await getDropCommunState()).canClaim, true)
  t.mock.timers.tick(1000)
  assert.equal(broadcasts, 1)
  const state = await getDropCommunState()
  assert.equal(state.canClaim, false)
  assert.equal(state.cooldownRemainingSeconds, 300)
  assert.deepEqual(await getOrCreateRoundCards(), [])
})

test('Une réclamation relance les 2 minutes sans être prolongée par les consultations', async t => {
  await openRound(t)
  for (const id of [1, 2, 3]) globalClaimState.activeUsers.set(String(id), Date.now())
  t.mock.timers.tick(20000)
  registerClaimedCard(1, 1)
  assert.equal(globalClaimState.inactivityEndsAtMs, Date.now() + 120000)
  t.mock.timers.tick(119000)
  // Garder les autres joueurs actifs pour ne pas terminer le round par déconnexion.
  for (const id of [1, 2, 3]) globalClaimState.activeUsers.set(String(id), Date.now())
  assert.equal((await getDropCommunState(2)).canClaim, true)
  assert.equal((await getDropCommunState(2)).claimRemainingSeconds, 1)
  t.mock.timers.tick(1000)
  assert.equal((await getDropCommunState(2)).cooldownRemainingSeconds, 300)
})

test('Le round suivant propose de nouvelles cartes après les 5 minutes de cooldown', async t => {
  await openRound(t)
  t.mock.timers.tick(120000)
  t.mock.timers.tick(300000)
  const state = await getDropCommunState(1)
  assert.equal(state.canClaim, true)
  assert.equal(state.cooldownRemainingSeconds, 0)
  assert.equal(globalClaimState.roundCards.length, 3)
  assert.equal(globalClaimState.inactivityEndsAtMs, Date.now() + 120000)
})

test('La fin normale du round démarre immédiatement le cooldown et annule le délai', async t => {
  await openRound(t)
  const state = registerClaimedCard(1, 1)
  assert.equal(state.cooldownRemainingSeconds, 300)
  assert.equal(globalClaimState.inactivityEndsAtMs, 0)
  t.mock.timers.tick(120000)
  assert.equal((await getDropCommunState()).cooldownRemainingSeconds, 180)
})
