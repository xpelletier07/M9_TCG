import DropSection from '../components/Dashboard/DropSection'
import BoosterPack from '../components/Dashboard/BoosterPack'
import CombatLog from '../components/Dashboard/CombatLog'
import '../css/Dashboard.css'

export default function MainContent(){
  return (

    <main className="dashboard-page">
      <div className="dashboard-container">
        <header className="dashboard-heading">
          <div>
            <span className="dashboard-kicker">M9 TCG · DASHBOARD</span>
            <h1>Votre dashboard</h1>
            <p>Reclamer vos cartes et les packs de cartes et voir votre historique de combat.</p>
          </div>
        </header>
        <div className="dashboard-grid">
          <DropSection />
          <BoosterPack />
        </div>
        <div className="dashboard-bottom-grid">
          <CombatLog />
        </div>
      </div>
    </main>
  )
}
