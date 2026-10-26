import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

// Page de retour après l'autorisation GitHub : le serveur y redirige avec { token, user } dans le fragment (#)
export default function GithubCallback() {
  const navigate = useNavigate()
  const { login } = useAuth()
  // Empêche le double appel de l'effet en StrictMode
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const params = new URLSearchParams(window.location.hash.slice(1))
    const token = params.get('token')
    const rawUser = params.get('user')

    try {
      if (!token || !rawUser) throw new Error('missing')
      login(JSON.parse(rawUser), token)
      // Retire le token de l'URL/historique avant de continuer
      window.history.replaceState(null, '', window.location.pathname)
      navigate('/', { replace: true })
    } catch {
      navigate('/login?error=erreur_serveur', { replace: true })
    }
  }, [login, navigate])

  return (
    <div className="auth-page">
      <div className="auth-box">
        <p className="auth-subtitle">Connexion avec GitHub...</p>
      </div>
    </div>
  )
}
