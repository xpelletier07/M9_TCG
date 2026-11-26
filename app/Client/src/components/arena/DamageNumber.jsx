// Chiffre de dégâts (ou de soin) flottant, positionné en coordonnées de la fenêtre
function DamageNumber({ amount, x, y, heal = false }) {
  return (
    <span className={`arena-damage ${heal ? 'arena-damage--heal' : ''}`} style={{ left: x, top: y }} aria-hidden="true">
      {heal ? '+' : '−'}{amount}
    </span>
  )
}

export default DamageNumber
