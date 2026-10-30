export default function LeaveConfirmation({ onCancel, onConfirm }) {
  return (
    <div className="combat-result-backdrop">
      <section
        className="combat-result combat-result-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-confirmation-title"
      >
        <span className="combat-kicker">Abandon du combat</span>
        <h2 id="leave-confirmation-title">Veux-tu vraiment abandonner ?</h2>
        <p>Cette action donnera la victoire à ton adversaire.</p>
        <div className="combat-result-actions">
          <button type="button" onClick={onCancel}>Annuler</button>
          <button type="button" onClick={onConfirm}>Oui, abandonner</button>
        </div>
      </section>
    </div>
  )
}
