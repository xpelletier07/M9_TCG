import { useCallback, useEffect, useRef, useState } from 'react'

// Durées (ms) des animations ; ramenées à presque 0 si l'utilisateur réduit les animations
const DURATIONS = { lunge: 380, hit: 420, death: 480, enter: 450, banner: 1300, damage: 900 }
const LOG_MAX = 30

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function elementFor(key) {
  if (key === 'player-me' || key === 'player-opponent') {
    return document.querySelector(`[data-player-side="${key.slice(7)}"] .arena-avatar`)
  }
  return document.querySelector(`.arena [data-instance-id="${CSS.escape(key)}"]`)
}

function centerOf(element) {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

// Index instanceId -> carte, dans un ou plusieurs états, pour nommer les cartes dans le journal
function indexCards(...states) {
  const map = new Map()
  for (const gs of states) {
    if (!gs) continue
    for (const card of [...gs.me.hand, ...gs.me.board, ...gs.opponent.board]) map.set(card.instanceId, card)
  }
  return map
}

// Joue les événements envoyés par le serveur en séquence, puis affiche le nouvel état.
// Tant que la file tourne, `displayedState` reste l'ancien état pour que les créatures mortes restent visibles.
export default function useArenaEvents() {
  const [displayedState, setDisplayedState] = useState(null)
  const [effects, setEffects] = useState({})
  const [damageNumbers, setDamageNumbers] = useState([])
  const [banner, setBanner] = useState(null)
  const [logEntries, setLogEntries] = useState([])
  const [clockOffset, setClockOffset] = useState(0)
  const queueRef = useRef([])
  const runningRef = useRef(false)
  const displayedRef = useRef(null)
  const idRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const nextId = () => ++idRef.current

  const setEffect = useCallback((key, value) => {
    setEffects((current) => {
      const next = { ...current }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  }, [])

  const playPayload = useCallback(async (gs) => {
    const reduced = prefersReducedMotion()
    const wait = (ms) => sleep(reduced ? 0 : ms)
    const previous = displayedRef.current
    const cards = indexCards(previous, gs)
    const me = gs.me.userId
    const nameOf = (playerId) => (playerId === me ? gs.myName : gs.opponentName)
    const sideOf = (playerId) => (playerId === me ? 'me' : 'opponent')
    const log = []
    const addLog = (kind, text, mine) => log.push({ id: nextId(), kind, text, mine })
    const events = gs.events ?? []

    // Phase 1 : attaques, dégâts et morts, jouées sur l'état actuellement affiché
    for (const event of events) {
      if (event.type === 'attack') {
        const attacker = cards.get(event.attackerId)
        const attackerIsMe = event.playerId === me
        const targetKey = event.target.type === 'player'
          ? (attackerIsMe ? 'player-opponent' : 'player-me')
          : event.target.instanceId
        const targetName = event.target.type === 'player'
          ? (attackerIsMe ? gs.opponentName : gs.myName)
          : cards.get(event.target.instanceId)?.nom_carte ?? 'une créature'
        const damage = events.find((e) => e.type === 'damage' && (event.target.type === 'player' ? e.targetType === 'player' : e.instanceId === event.target.instanceId))
        addLog('attack', `${attacker?.nom_carte ?? 'Une créature'} attaque ${targetName}${damage ? ` (−${damage.amount})` : ''}`, event.playerId === me)

        const from = elementFor(event.attackerId)
        const to = elementFor(targetKey)
        if (from && to && !reduced) {
          const a = centerOf(from)
          const b = centerOf(to)
          from.style.setProperty('--lunge-x', `${(b.x - a.x) * 0.7}px`)
          from.style.setProperty('--lunge-y', `${(b.y - a.y) * 0.7}px`)
        }
        setEffect(event.attackerId, 'is-attacking')
        await wait(DURATIONS.lunge)
        setEffect(event.attackerId, null)
      }

      if (event.type === 'damage') {
        const key = event.targetType === 'player' ? `player-${sideOf(event.playerId)}` : event.instanceId
        const element = elementFor(key)
        if (element) {
          const { x, y } = centerOf(element)
          const id = nextId()
          setDamageNumbers((list) => [...list, { id, amount: event.amount, x, y }])
          setTimeout(() => mountedRef.current && setDamageNumbers((list) => list.filter((d) => d.id !== id)), reduced ? 600 : DURATIONS.damage)
        }
        setEffect(key, 'is-hit')
      }

      if (event.type === 'death') {
        setEffect(event.instanceId, 'is-dying')
        addLog('death', `${event.nom_carte} est détruite`, event.playerId === me)
      }
    }
    if (events.some((e) => e.type === 'damage')) await wait(DURATIONS.hit)
    if (events.some((e) => e.type === 'death')) await wait(DURATIONS.death)

    // Phase 2 : nouvel état, puis animations d'entrée (cartes posées / piochées)
    displayedRef.current = gs
    setDisplayedState(gs)
    setEffects({})
    setClockOffset(gs.serverNow - Date.now())

    const entering = []
    const isOpeningDeal = events.filter((e) => e.type === 'draw').length > 2
    if (isOpeningDeal) addLog('draw', 'Les mains de départ sont distribuées', false)
    for (const event of events) {
      if (event.type === 'turn') {
        const mine = event.playerId === me
        addLog('turn', `Tour ${event.turn} — ${nameOf(event.playerId)}`, mine)
        setBanner({ id: nextId(), mine, text: mine ? 'À toi de jouer !' : `Tour de ${nameOf(event.playerId)}` })
      }
      if (event.type === 'play') {
        addLog('play', `${nameOf(event.playerId)} pose ${event.card.nom_carte}`, event.playerId === me)
        entering.push(event.card.instanceId)
      }
      if (event.type === 'draw') {
        if (event.card) entering.push(event.card.instanceId)
        if (!isOpeningDeal) addLog('draw', `${nameOf(event.playerId)} pioche une carte`, event.playerId === me)
      }
      if (event.type === 'burn') {
        addLog('burn', event.card
          ? `${event.card.nom_carte} est brûlée (main pleine)`
          : `${nameOf(event.playerId)} perd une carte (main pleine)`, event.playerId === me)
      }
      if (event.type === 'gameover') {
        addLog('gameover', `${nameOf(event.winnerId)} remporte le combat`, event.winnerId === me)
      }
    }

    if (log.length) setLogEntries((current) => [...log.reverse(), ...current].slice(0, LOG_MAX))
    if (entering.length) {
      setEffects(Object.fromEntries(entering.map((id) => [id, 'is-entering'])))
      await wait(DURATIONS.enter)
      setEffects({})
    }
  }, [setEffect])

  // Nouveau payload du serveur : ajouté à la file, jouée dans l'ordre
  const enqueue = useCallback((gs) => {
    queueRef.current.push(gs)
    if (runningRef.current) return
    runningRef.current = true
    ;(async () => {
      try {
        while (queueRef.current.length && mountedRef.current) {
          const next = queueRef.current.shift()
          try {
            await playPayload(next)
          } catch (error) {
            // Une animation ratée ne doit jamais bloquer la partie : on affiche directement l'état
            console.error('Animation du combat interrompue :', error)
            displayedRef.current = next
            setDisplayedState(next)
            setEffects({})
          }
        }
      } finally {
        runningRef.current = false
      }
    })()
  }, [playPayload])

  // La bannière disparaît d'elle-même
  useEffect(() => {
    if (!banner) return undefined
    const id = setTimeout(() => setBanner(null), prefersReducedMotion() ? 900 : DURATIONS.banner)
    return () => clearTimeout(id)
  }, [banner])

  const isAnimating = useCallback(() => runningRef.current, [])

  return { displayedState, effects, damageNumbers, banner, logEntries, clockOffset, enqueue, isAnimating }
}
