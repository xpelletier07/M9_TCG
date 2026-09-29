function Inventaire() {
  return (
    <main className="content-left-spacing">
      <h1 className="inventory-title">Inventaire de cartes</h1>
      <p className="inventory-subtitle">C&apos;est trop bien les cartes ngl</p>
      <hr className="inventory-divider" />

      <div className="filters">
        <div className="field filter-text">
          <label className="label">Filtres</label>
          <div className="control">
            <input className="input" type="text" placeholder="Text input" />
          </div>
        </div>
      </div>

      <div className="cards-container" />
    </main>
  )
}

export default Inventaire