import React from 'react'

export default function CombatLog(){
  return (
    <section className="dashboard-panel dashboard-combat">
      <div className="dashboard-combat-header">
        <h2 className="dashboard-combat-title">Historique de combats</h2>
        <button className="dashboard-view-all">View All</button>
      </div>

      <div>
        <p className="dashboard-empty">Il n'y a rien pour l'instant.</p>
      </div>
    </section>
  )
}
