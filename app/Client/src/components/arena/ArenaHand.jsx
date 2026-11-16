// Main du joueur en éventail : chaque carte est tournée selon sa position.
// `renderCard(card, style)` permet à l'arène de brancher interactions et animations.
function ArenaHand({ cards, renderCard }) {
  const middle = (cards.length - 1) / 2
  return (
    <div className="arena-hand" aria-label="Cartes en main">
      {cards.length === 0 && <span className="arena-hand-empty">Aucune carte en main</span>}
      {cards.map((card, index) => {
        const offset = index - middle
        const style = {
          '--fan-rotate': `${offset * 4}deg`,
          '--fan-lift': `${Math.abs(offset) * Math.abs(offset) * 2}px`,
          zIndex: index + 1,
        }
        return renderCard(card, style)
      })}
    </div>
  )
}

export default ArenaHand
