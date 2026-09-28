import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { API_BASE_URL } from '../../config'
import './Auth.css'

export default function Signup() {
  const navigate = useNavigate()
  const [nomUtilisateur, setNomUtilisateur] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEmailBlur() {
    if (!email) return

    try {
      const response = await fetch(`${API_BASE_URL}/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()
      setEmailError(data.exists ? 'Cet email est déjà utilisé' : '')
    } catch (err) {
      // Silencieux : la vérification finale se refera de toute façon au submit
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!nomUtilisateur || !email || !password) {
      setError('Tous les champs sont requis')
      return
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom_utilisateur: nomUtilisateur, email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Une erreur est survenue')
        return
      }

      navigate('/login')
    } catch (err) {
      setError('Impossible de contacter le serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1>Inscription</h1>
        <p className="auth-subtitle">Créez votre compte pour commencer à jouer</p>

        <form onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <i className="fi fi-rs-user"></i>
            <input
              type="text"
              placeholder="nom d'utilisateur"
              aria-label="nom d'utilisateur"
              value={nomUtilisateur}
              onChange={(e) => setNomUtilisateur(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="auth-input-group">
            <i className="fi fi-rs-envelope"></i>
            <input
              type="email"
              placeholder="e-mail"
              aria-label="e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              autoComplete="email"
            />
          </div>
          {emailError && <p className="auth-error">{emailError}</p>}

          <div className="auth-input-group">
            <i className="fi fi-rs-lock"></i>
            <input
              type="password"
              placeholder="mot de passe"
              aria-label="mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="auth-input-group">
            <i className="fi fi-rs-lock"></i>
            <input
              type="password"
              placeholder="confirmer le mot de passe"
              aria-label="confirmer le mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Création...' : 'Créer un compte'}
          </button>
        </form>

        <p className="auth-footer">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
