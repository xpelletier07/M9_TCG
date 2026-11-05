import { useEffect } from 'react'
import { Link } from 'react-router-dom'

// Fenêtre de sélection : seulement les decks valides (50 cartes, toutes possédées)
function DeckPickerModal({ open, decks, loading, error, selectedDeckId, onSelect, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="deck-picker-backdrop" onClick={onClose}>
      <div
        className="deck-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="deck-picker-header">
          <div>
            <span className="deck-picker-kicker">Préparation</span>
            <h2 id="deck-picker-title">Choisis ton deck</h2>
          </div>
          <button type="button" className="deck-picker-close" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        {loading && <p className="deck-picker-status">Chargement de tes decks…</p>}
        {error && <p className="deck-picker-status is-error">{error}</p>}
        {!loading && !error && decks.length === 0 && (
          <div className="deck-picker-empty">
            <p>Aucun deck valide (50 cartes).</p>
            <Link to="/decks" className="deck-picker-link">Construire un deck</Link>
          </div>
        )}

        {!loading && !error && decks.length > 0 && (
          <ul className="deck-picker-grid">
            {decks.map((deck) => (
              <li key={deck.id_deck}>
                <button
                  type="button"
                  className={`deck-picker-item ${deck.id_deck === selectedDeckId ? 'is-selected' : ''}`}
                  onClick={() => onSelect(deck)}
                >
                  <span className="deck-picker-art">
                    <img src={deck.image} alt="" />
                  </span>
                  <strong>{deck.nom_deck}</strong>
                  <span>{deck.total_cartes} cartes · {deck.nom_carte_image}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default DeckPickerModal
