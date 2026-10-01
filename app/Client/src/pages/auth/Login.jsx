import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { API_BASE_URL } from '../../config'
import { useAuth } from '../../auth/AuthContext'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Soumission du formulaire de connexion
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Validation côté client avant d'appeler l'API (le serveur revalide de toute façon)
    if (!email || !password) {
      setError('Email et mot de passe requis')
      return
    }

    setLoading(true)

    try {
      // Appelle POST /auth/login sur le backend avec les identifiants saisis
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      // Identifiants invalides ou autre erreur serveur -> affiche le message renvoyé par l'API
      if (!response.ok) {
        setError(data.error || 'Une erreur est survenue')
        return
      }

      // Succès : stocke le token/user via AuthContext puis redirige vers l'app
      login(data.user, data.token)
      navigate('/dashboard')
    } catch (err) {
      setError('Impossible de contacter le serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    // Conteneur plein écran de la page d'authentification
    <div className="auth-page">
      {/* Carte centrée contenant le formulaire de connexion */}
      <div className="auth-box">
        <h1>Connexion</h1>
        <p className="auth-subtitle">Restez connecté à votre compte</p>

        {/* handleSubmit intercepte le submit natif pour valider puis appeler l'API */}
        <form onSubmit={handleSubmit}>
          {/* Champ email : input contrôlé lié à l'état email */}
          <div className="auth-input-group">
            <i className="fa-solid fa-envelope"></i>
            <input
              type="email"
              placeholder="e-mail"
              aria-label="e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {/* Champ mot de passe : saisie masquée (type="password") */}
          <div className="auth-input-group">
            <i className="fa-solid fa-lock"></i>
            <input
              type="password"
              placeholder="mot de passe"
              aria-label="mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // current-password = autorise le navigateur à proposer un mot de passe déjà enregistré
              autoComplete="current-password"
            />
          </div>

          {/* Erreur globale : validation côté client échouée ou réponse d'erreur de l'API */}
          {error && <p className="auth-error">{error}</p>}

          {/* Désactivé pendant l'appel réseau pour éviter une double soumission */}
          <button type="submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Lien vers la page d'inscription pour les nouveaux utilisateurs */}
        <p className="auth-footer">
          Pas encore de compte ? <Link to="/signup">S'inscrire</Link>
        </p>
      </div>
    </div>
  )
}
