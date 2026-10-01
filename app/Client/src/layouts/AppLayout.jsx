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

// Layout commun aux pages protégées : Sidebar fixe + zone de contenu (Outlet = route enfant active)
function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const currentPage = Object.entries(pagePaths).find(([, path]) => path === location.pathname)?.[0] ?? 'accueil'

  function handleNavigate(page) {
    navigate(pagePaths[page] ?? '/')
  }

  // Déconnexion déclenchée par le bouton de la Sidebar : vide le contexte d'auth puis renvoie vers /login
  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    // tcg-layout place la Sidebar et le contenu côte à côte (voir CSS)
    <div className="tcg-layout">
      <Sidebar
        // currentPage/onNavigate : non utilisés par Sidebar actuellement (NavLink gère la navigation directement)
        currentPage={currentPage}
        onNavigate={handleNavigate}
        // false tant que AuthContext n'a pas de user (non connecté)
        loggedIn={Boolean(user)}
        onLogout={handleLogout}
      />
      {/* Affiche la route enfant active définie dans Routeur.jsx */}
      <Outlet />
    </div>
  )
}

export default AppLayout