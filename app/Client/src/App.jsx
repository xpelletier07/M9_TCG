import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Sidebar from './sidebar/Sidebar'

function App() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState('accueil')

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const activeLabel = currentPage.charAt(0).toUpperCase() + currentPage.slice(1)

  return (
    <div className="tcg-layout">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        loggedIn
        onLogout={handleLogout}
      />

      <main className="tcg-content">
        <h1>{currentPage === 'accueil' ? `Bienvenue${user ? `, ${user.nom_utilisateur}` : ''}` : activeLabel}</h1>
      </main>
    </div>
  )
}

export default App

