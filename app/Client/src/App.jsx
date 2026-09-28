import React from 'react'
import TopAppBar from './components/TopAppBar'
import MainContent from './components/MainContent'
import Sidebar from './sidebar/Sidebar'
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

export default function App(){
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
}

export default App

