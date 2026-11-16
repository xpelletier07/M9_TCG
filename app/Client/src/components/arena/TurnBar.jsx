import { useEffect, useState } from 'react'

const WARNING_SECONDS = 15

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Ligne de tour : numéro, minuterie (synchronisée sur l'horloge du serveur) et bouton de fin de tour
function TurnBar({ turn, isMyTurn, opponentName, turnEndsAt, clockOffset, onEndTurn, disabled = false }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [])

  const remaining = turnEndsAt ? Math.max(0, Math.ceil((turnEndsAt - (now + clockOffset)) / 1000)) : 0
  const warning = remaining <= WARNING_SECONDS

  return (
    <div className={`arena-turn ${isMyTurn ? 'is-mine' : 'is-theirs'}`}>
      <span className="arena-turn-line" aria-hidden="true" />
      <span className="arena-turn-count">Tour {turn}</span>
      <span className={`arena-turn-timer ${warning ? 'is-warning' : ''}`} aria-live={warning ? 'polite' : 'off'}>
        {formatTime(remaining)}
      </span>
      {isMyTurn ? (
        <button className="arena-end-turn" type="button" onClick={onEndTurn} disabled={disabled}>
          Fin du tour
        </button>
      ) : (
        <span className="arena-turn-waiting">Tour de {opponentName}…</span>
      )}
      <span className="arena-turn-line" aria-hidden="true" />
    </div>
  )
}

export default TurnBar
