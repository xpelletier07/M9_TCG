import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

// Enveloppe une route pour exiger un token (confort UX seulement, la vraie protection
// est faite côté serveur par le middleware checkAuth sur chaque requête API)
export default function ProtectedRoute({ children }) {
  const { token } = useAuth()

  // Pas de token (non connecté ou déjà déconnecté) -> redirection vers la page de connexion
  if (!token) {
    // replace: évite d'empiler /login dans l'historique du navigateur
    return <Navigate to="/login" replace />
  }

  // Token présent -> affiche la route protégée demandée telle quelle
  return children
}
