const REASONS = {
  combat: 'Points de vie réduits à 0',
  fatigue: 'Plus aucune carte à piocher',
  leave: 'Abandon',
  disconnect: 'Déconnexion',
}

export default function CombatResult({ result, onDashboard, onLobby }) {
  const victory = result.result === 'victory'
  return (
    <div className="arena-result-backdrop">
      <section
        className={`arena-result ${victory ? 'is-victory' : 'is-defeat'}`}
        aria-live="assertive"
        role="dialog"
        aria-modal="true"
        aria-labelledby="combat-result-title"
      >
        <span className="arena-result-glow" aria-hidden="true" />
        <span className="arena-result-kicker">Combat terminé</span>
        <h2 id="combat-result-title" className="arena-result-title">
          {victory ? 'Victoire !' : 'Défaite'}
        </h2>
        {REASONS[result.reason] && <p className="arena-result-reason">{REASONS[result.reason]}</p>}
        <dl className="arena-result-players">
          <div>
            <dt>Gagnant</dt>
            <dd>{result.winnerName ?? 'Joueur restant'}</dd>
          </div>
          <div>
            <dt>Perdant</dt>
            <dd>{result.loserName ?? 'Joueur parti'}</dd>
          </div>
        </dl>
        <div className="arena-result-actions">
          {onLobby && <button type="button" className="arena-result-primary" onClick={onLobby}>Retour au lobby</button>}
          <button type="button" className="arena-result-secondary" onClick={onDashboard}>Dashboard</button>
        </div>
      </section>
    </div>
  )
}
