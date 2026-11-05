import { useCallback, useEffect, useRef, useState } from 'react'

const DRAG_THRESHOLD = 6

// Cible sous le pointeur : créature adverse, joueur adverse ou mon terrain
function findDropTarget(x, y) {
  const element = document.elementFromPoint(x, y)
  if (!element) return null
  const opponentCard = element.closest('[data-side="opponent"] [data-instance-id]')
  if (opponentCard) return { type: 'card', instanceId: opponentCard.dataset.instanceId }
  if (element.closest('[data-target="player"]')) return { type: 'player' }
  if (element.closest('[data-drop="board"]')) return { type: 'board' }
  return null
}

// Gère les deux façons de jouer : clic (sélection puis cible) et glisser-déposer.
// drag = { kind: 'play' | 'attack', instanceId, originX, originY, x, y, over } pendant un glisser.
export default function useArenaTargeting({ enabled, onPlay, onAttack }) {
  const [selectedAttackerId, setSelectedAttackerId] = useState(null)
  const [drag, setDrag] = useState(null)
  const pressRef = useRef(null)
  const callbacksRef = useRef({ onPlay, onAttack })

  useEffect(() => {
    callbacksRef.current = { onPlay, onAttack }
  }, [onPlay, onAttack])

  const cancel = useCallback(() => {
    setSelectedAttackerId(null)
    setDrag(null)
    pressRef.current = null
  }, [])

  // Plus mon tour : on oublie toute sélection en cours
  useEffect(() => {
    if (enabled) return undefined
    const id = setTimeout(cancel, 0)
    return () => clearTimeout(id)
  }, [enabled, cancel])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  useEffect(() => {
    function onMove(event) {
      const press = pressRef.current
      if (!press) return
      const dx = event.clientX - press.originX
      const dy = event.clientY - press.originY
      if (!press.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      press.dragging = true
      setDrag({
        kind: press.kind,
        instanceId: press.instanceId,
        originX: press.anchorX,
        originY: press.anchorY,
        startX: press.originX,
        startY: press.originY,
        x: event.clientX,
        y: event.clientY,
        over: findDropTarget(event.clientX, event.clientY),
      })
    }

    function onUp(event) {
      const press = pressRef.current
      if (!press) return
      pressRef.current = null
      const { onPlay: play, onAttack: hit } = callbacksRef.current

      if (!press.dragging) {
        // Simple clic
        if (press.kind === 'play') play(press.instanceId)
        else setSelectedAttackerId((current) => (current === press.instanceId ? null : press.instanceId))
        return
      }

      setDrag(null)
      const target = findDropTarget(event.clientX, event.clientY)
      if (press.kind === 'play' && target?.type === 'board') play(press.instanceId)
      if (press.kind === 'attack' && (target?.type === 'card' || target?.type === 'player')) {
        hit(press.instanceId, target.type === 'card' ? { type: 'card', instanceId: target.instanceId } : { type: 'player' })
        setSelectedAttackerId(null)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [cancel])

  function startPress(kind, instanceId, event) {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    pressRef.current = {
      kind,
      instanceId,
      originX: event.clientX,
      originY: event.clientY,
      anchorX: rect.left + rect.width / 2,
      anchorY: rect.top + rect.height / 2,
      dragging: false,
    }
  }

  // Carte de ma main : jouable si `playable`
  function bindHandCard(card, playable) {
    if (!enabled || !playable) return {}
    return { onPointerDown: (event) => startPress('play', card.instanceId, event) }
  }

  // Créature de mon terrain : peut attaquer si `canAttack`
  function bindBoardCard(card) {
    if (!enabled || !card.canAttack) return {}
    return { onPointerDown: (event) => startPress('attack', card.instanceId, event) }
  }

  // Cible adverse (créature ou joueur) pour le mode clic
  function bindTarget(target) {
    if (!enabled || !selectedAttackerId) return {}
    return {
      onClick: (event) => {
        event.stopPropagation()
        callbacksRef.current.onAttack(selectedAttackerId, target)
        setSelectedAttackerId(null)
      },
    }
  }

  const aiming = enabled && (Boolean(selectedAttackerId) || drag?.kind === 'attack')

  return { selectedAttackerId, drag, aiming, bindHandCard, bindBoardCard, bindTarget, cancel }
}
