import { useEffect, useRef, useState } from 'react'

const RARITY_LABELS = { 1: 'Commune', 2: 'Rare', 3: 'Épique', 4: 'Légendaire' }

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
  const previewTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(previewTimerRef.current), [])

  function startPreview() {
    if (variant === 'preview') return
    clearTimeout(previewTimerRef.current)
    previewTimerRef.current = setTimeout(() => setShowPreview(true), 500)
  }

  function stopPreview() {
    clearTimeout(previewTimerRef.current)
    setShowPreview(false)
  }

  const hp = card.currentHp ?? card.health
  const classes = [
    'arena-card',
    `arena-card--${variant}`,
    `arena-card--r${card.rarete ?? 1}`,
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
      className={classes}
      data-instance-id={card.instanceId}
      style={style}
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
      onPointerDownCapture={stopPreview}
      {...handlers}
    >
      <div className="arena-card-frame">
        {variant !== 'board' && <span className="arena-card-cost" title="Coût en mana">{card.mana}</span>}
        <div className="arena-card-art">
          <img src={card.image} alt="" draggable="false" />
        </div>
        <div className="arena-card-name">{card.nom_carte}</div>
        {variant === 'preview' && (
          <div className="arena-card-desc">
            <span className="arena-card-rarity">{RARITY_LABELS[card.rarete] ?? ''}</span>
            {card.description}
          </div>
        )}
        <span className="arena-card-stat arena-card-atk" title="Attaque">{card.damage}</span>
        <span className={`arena-card-stat arena-card-hp ${hp < card.health ? 'is-damaged' : ''}`} title="Points de vie">
          {hp}
        </span>
      </div>
      {showPreview && !dragging && (
        <div className={`arena-card-preview arena-card-preview--${variant}`} aria-hidden="true">
          <ArenaCard card={card} variant="preview" />
        </div>
      )}
    </div>
  )
}

export default ArenaCard
