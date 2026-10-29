export default function CombatResult({ result, onDashboard }) {
  return (
    <div className="combat-result-backdrop">
      <section
        className={`combat-result combat-result-${result.result}`}
        aria-live="assertive"
        role="dialog"
        aria-modal="true"
        aria-labelledby="combat-result-title"
      >
        <span className="combat-kicker">Combat terminé</span>
        <h2 id="combat-result-title">
          {result.result === 'victory' ? 'Victoire !' : 'Défaite'}
        </h2>
        <p>
          Gagnant : <strong>{result.winnerName ?? 'Joueur restant'}</strong>
        </p>
        <p>
          Perdant : <strong>{result.loserName ?? 'Joueur parti'}</strong>
        </p>
        <button type="button" onClick={onDashboard}>Retour au dashboard</button>
      </section>
    </div>
  )
}
