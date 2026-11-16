// Flèche de visée (SVG plein écran) de la créature qui attaque jusqu'au pointeur
function TargetingArrow({ drag }) {
  if (!drag || drag.kind !== 'attack') return null
  const { originX: x1, originY: y1, x: x2, y: y2, over } = drag
  const midX = (x1 + x2) / 2
  const midY = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.25 - 40
  const locked = over?.type === 'card' || over?.type === 'player'

  return (
    <svg className={`arena-arrow ${locked ? 'is-locked' : ''}`} aria-hidden="true">
      <defs>
        <marker id="arena-arrow-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" />
        </marker>
      </defs>
      <path d={`M${x1},${y1} Q${midX},${midY} ${x2},${y2}`} markerEnd="url(#arena-arrow-head)" />
      <circle cx={x2} cy={y2} r={locked ? 22 : 14} />
    </svg>
  )
}

export default TargetingArrow
