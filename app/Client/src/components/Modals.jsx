const raretes = {
    1: "Commun",
    2: "Rare",
    3: "Épique",
    4: "Légendaire",
}

export function CardModal({ isOpen, carte, onClose }) {
    if (!isOpen || !carte) return null
    return (
        <div className="modal is-active" role="dialog" aria-modal="true" aria-labelledby="card-modal-title">
            <div className="modal-background" onClick={onClose} />
            <div className="modal-card">
                <header className="modal-card-head">
                    <p id="card-modal-title" className="modal-card-title">{carte.nom_carte}</p>
                    <button type="button" className="delete" aria-label="Fermer" onClick={onClose} />
                </header>
                <section className="modal-card-body">
                    <figure className="image mb-5">
                        <img src={carte.image} alt={`Image de la carte ${carte.nom_carte}`} />
                    </figure>
                    {carte.description && (
                        <p className="mb-5">{carte.description}</p>
                    )}
                    <div className="columns is-multiline">
                        <div className="column is-half">
                            <strong>Rareté :</strong>{" "}
                            {raretes[carte.rarete] ?? carte.rarete}
                        </div>
                        <div className="column is-half">
                            <strong>Mana :</strong> {carte.mana}
                        </div>
                        <div className="column is-half">
                            <strong>Attaque :</strong> {carte.damage}
                        </div>
                        <div className="column is-half">
                            <strong>Vie :</strong> {carte.health}
                        </div>
                        <div className="column is-half">
                            <strong>Valeur :</strong> {carte.valeur}
                        </div>
                    </div>
                </section>
                <footer className="modal-card-foot">
                    <button type="button" className="button" onClick={onClose}>Fermer</button>
                </footer>
            </div>
        </div>
    )
}