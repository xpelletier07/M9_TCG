import React from 'react'

export default function CombatLog(){
  return (
    <section className="dashboard-panel dashboard-combat">
      <div className="dashboard-combat-header">
        <h2 className="dashboard-combat-title">Historique de combats</h2>
        <button className="dashboard-view-all" type="button" disabled>View All</button>
      </div>

      <div>
        <span className="feature-status-label">En développement</span>
        <p className="dashboard-empty">L'historique des combats est en développement et sera disponible dans une prochaine version.</p>
      </div>
    </section>
  )
}
