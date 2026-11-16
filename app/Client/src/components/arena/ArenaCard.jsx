import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Card from '../Card.jsx'

const PREVIEW_GAP = 12
const VIEWPORT_MARGIN = 8

// Place l'aperçu à côté de la carte (au-dessus pour la main), sans sortir de l'écran
function computePreviewPosition(cardRect, previewRect, variant) {
  let left
  let top
  if (variant === 'hand') {
    left = cardRect.left + cardRect.width / 2 - previewRect.width / 2
    top = cardRect.top - previewRect.height - PREVIEW_GAP
  } else {
    left = cardRect.right + PREVIEW_GAP
    if (left + previewRect.width > window.innerWidth - VIEWPORT_MARGIN) {
      left = cardRect.left - previewRect.width - PREVIEW_GAP
    }
    top = cardRect.top + cardRect.height / 2 - previewRect.height / 2
  }
  const maxLeft = window.innerWidth - previewRect.width - VIEWPORT_MARGIN
  const maxTop = window.innerHeight - previewRect.height - VIEWPORT_MARGIN
  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(left, maxLeft)),
    top: Math.max(VIEWPORT_MARGIN, Math.min(top, maxTop)),
  }
}

// Carte de l'arène (main, terrain ou aperçu agrandi).
// `effect` est la classe d'animation courante (is-entering, is-attacking, is-hit, is-dying…).
function ArenaCard({
  card,
  variant = 'board',
  playable = false,
  selected = false,
  canAttack = false,
  targetable = false,
  dimmed = false,
  dragging = false,
  effect = '',
  style,
  className = '',
  ...handlers
}) {
  const [showPreview, setShowPreview] = useState(false)
  const [previewPosition, setPreviewPosition] = useState(null)
  const previewTimerRef = useRef(null)
  const cardRef = useRef(null)
  const previewRef = useRef(null)

  useEffect(() => () => clearTimeout(previewTimerRef.current), [])

  // Mesure avant l'affichage pour éviter un saut de position
  useLayoutEffect(() => {
    if (!showPreview || !cardRef.current || !previewRef.current) return
    setPreviewPosition(computePreviewPosition(
      cardRef.current.getBoundingClientRect(),
      previewRef.current.getBoundingClientRect(),
      variant,
    ))
  }, [showPreview, variant])

  function startPreview() {
    if (variant === 'preview') return
    clearTimeout(previewTimerRef.current)
    previewTimerRef.current = setTimeout(() => setShowPreview(true), 500)
  }

  function stopPreview() {
    clearTimeout(previewTimerRef.current)
    setShowPreview(false)
    setPreviewPosition(null)
  }

  const hp = card.currentHp ?? card.health
  const classes = [
    'arena-card',
    `arena-card--${variant}`,
    playable && 'is-playable',
    selected && 'is-selected',
    canAttack && 'can-attack',
    targetable && 'is-targetable',
    dimmed && 'is-dimmed',
    dragging && 'is-dragging',
    effect,
    className,
  ].filter(Boolean).join(' ')

  return (
    <div
      ref={cardRef}
      className={classes}
      data-instance-id={card.instanceId}
      style={style}
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
      onPointerDownCapture={stopPreview}
      {...handlers}
    >
      <div className="arena-card-frame">
        <Card carte={{ ...card, health: hp }} className={hp < card.health ? 'is-damaged' : ''} />
      </div>
      {/* Portail : l'aperçu n'hérite pas des filtres ni des transformations de la carte survolée */}
      {showPreview && !dragging && createPortal(
        <div
          ref={previewRef}
          className="arena-card-preview"
          style={previewPosition ?? { visibility: 'hidden' }}
          aria-hidden="true"
        >
          <ArenaCard card={card} variant="preview" />
        </div>,
        document.body,
      )}
    </div>
  )
}

export default ArenaCard
