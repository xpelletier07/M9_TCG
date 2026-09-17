//Page de test pour que je puisse tester la sidebar
import { useState } from 'react'
import Sidebar from './sidebar/Sidebar'

export default function PageTestMarco() {
  const [active, setActive] = useState('accueil')
  const [loggedIn, setLoggedIn] = useState(true)

  const activeLabel = active.charAt(0).toUpperCase() + active.slice(1)

  return (
    <div className="tcg-layout">
      <Sidebar
        currentPage={active}
        onNavigate={setActive}
        loggedIn={loggedIn}
        onLogout={() => setLoggedIn(false)}
      />

      <main className="tcg-content">
        <h1>{activeLabel}</h1>
        <p>Contenu de démonstration pour la page « {activeLabel} » de M9_TCG.</p>
      </main>
    </div>
  )
}
