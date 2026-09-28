import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import Collection from './Pages/Collection'
import Login from './Pages/auth/Login'
import Signup from './Pages/auth/Signup'
import MainContent from './components/MainContent'
import Sidebar from './components/Sidebar'
import { useAuth } from './auth/AuthContext'

function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState('accueil')

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="tcg-layout">
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page)
          if (page === 'catalogue') {
            navigate('/collection')
          }
        }}
        loggedIn
        onLogout={handleLogout}
      />

      <div className="tcg-content">
        <div className="p-4">
          <h1 className="title is-4">
            Bienvenue{user ? `, ${user.nom_utilisateur}` : ''}
          </h1>
        </div>
        <MainContent />
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/collection"
            element={
              <ProtectedRoute>
                <Collection />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<div className="section has-text-centered">Page non trouvée</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

