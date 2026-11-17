import { Link } from 'react-router-dom'

export default function CardGrid() {
  return (
    <section className="dashboard-panel dashboard-collection" aria-labelledby="dashboard-collection-title">
      <div className="dashboard-combat-header">
        <div>
          <span className="dashboard-kicker">VOTRE COLLECTION</span>
          <h2 id="dashboard-collection-title" className="dashboard-combat-title">Cartes débloquées</h2>
        </div>
        <Link className="dashboard-view-all" to="/collection">Voir la collection <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="dashboard-placeholder">
        <span className="dashboard-placeholder-icon" aria-hidden="true"><i className="fa-regular fa-clone" /></span>
        <h3>Votre collection vous attend</h3>
        <p className="dashboard-empty">Retrouvez vos cartes dans la collection. Leur aperçu sur le tableau de bord sera disponible prochainement.</p>
      </div>
    </section>
  )
}
