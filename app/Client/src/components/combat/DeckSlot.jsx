// Emplacement du deck dans le lobby : image du deck choisi, ou un « + » si aucun
function DeckSlot({ deck, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={`deck-slot ${deck ? 'has-deck' : 'is-empty'}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={deck ? `Deck choisi : ${deck.nom_deck}. Changer de deck` : 'Choisir un deck'}
    >
      {deck ? (
        <>
          <span className="deck-slot-art">
            <img src={deck.image} alt="" />
          </span>
          <span className="deck-slot-info">
            <span className="deck-slot-label">Ton deck</span>
            <strong>{deck.nom_deck}</strong>
            <span>{deck.total_cartes} cartes · Changer</span>
          </span>
        </>
      ) : (
        <>
          <span className="deck-slot-plus" aria-hidden="true">+</span>
          <span className="deck-slot-info">
            <span className="deck-slot-label">Aucun deck</span>
            <strong>Choisir un deck</strong>
          </span>
        </>
      )}
    </button>
  )
}

export default DeckSlot
