function Inventaire() {
    return (
        <div className="content-left-spacing">
            {/* Titres */}
            <h1 className="inventory-title">Inventaire de cartes</h1>
            <p className="inventory-subtitle">C&apos;est trop bien les cartes ngl</p>
            <hr className="inventory-divider" />

            {/* Filtres */}
            <div className="filters">
                <div className="field filter-text">
                    <label className="label">Filtres</label>
                    <div className="control">
                        <input className="input" type="text" placeholder="Text input" />
                    </div>
                </div>
            </div>

            {/* Liste des Cartes */}
            <div className="cards-container">

            </div>
        </div>
    )
}

export default Inventaire
