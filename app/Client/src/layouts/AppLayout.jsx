import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import Sidebar from '../components/Sidebar.jsx'

const pagePaths = {
  accueil: '/',
  collection: '/collection',
  bazaar: '/bazaar',
  inventaire: '/inventaire',
  combat: '/combat',
}

function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const currentPage = Object.entries(pagePaths).find(([, path]) => path === location.pathname)?.[0] ?? 'accueil'

  function handleNavigate(page) {
    navigate(pagePaths[page] ?? '/')
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="tcg-layout">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        loggedIn={Boolean(user)}
        onLogout={handleLogout}
      />
      <Outlet />
    </div>
  )
}

export default AppLayout