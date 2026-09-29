import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Sidebar from './components/Sidebar'

function App() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="tcg-layout">
      <Sidebar loggedIn onLogout={handleLogout} />

      <main className="tcg-content">
        <Outlet />
      </main>
    </div>
  )
}

export default App

