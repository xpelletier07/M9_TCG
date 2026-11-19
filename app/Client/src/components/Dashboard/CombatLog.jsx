
export default function CombatLog(){
  return (
    <section className="dashboard-panel dashboard-combat">
      <div className="dashboard-combat-header">
        <div><span className="dashboard-kicker">VOS BATAILLES</span><h2 className="dashboard-combat-title">Historique de combats</h2></div>
        <h2 className="dashboard-combat-subtitle">Chaque combat a son histoire</h2>
      </div>

      <div className="dashboard-placeholder">
        <span className="dashboard-placeholder-icon" aria-hidden="true"><i className="fa-solid fa-shield-halved" /></span>
        <h3>Chaque combat a son histoire</h3>
        <p className="dashboard-empty">L'historique des combats est en développement et sera disponible dans une prochaine version.</p>
      </div>
    </section>
  )
}
