// Chiffre de dégâts flottant, positionné en coordonnées de la fenêtre
function DamageNumber({ amount, x, y }) {
  return (
    <span className="arena-damage" style={{ left: x, top: y }} aria-hidden="true">
      −{amount}
    </span>
  )
}

export default DamageNumber
