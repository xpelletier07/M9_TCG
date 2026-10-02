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

  // Vérification en direct (au blur du champ email) : évite d'attendre le submit pour prévenir l'utilisateur
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

  // Soumission du formulaire d'inscription
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Validations côté client (champs requis, longueur du mot de passe, confirmation) avant l'appel API
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
      // Appelle POST /auth/signup pour créer le compte
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

      // Pas de connexion automatique : l'utilisateur doit se connecter après son inscription
      navigate('/login')
    } catch (err) {
      setError('Impossible de contacter le serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    // Conteneur plein écran de la page d'authentification
    <div className="auth-page">
      {/* Carte centrée contenant le formulaire d'inscription */}
      <div className="auth-box">
        <h1>Inscription</h1>
        <p className="auth-subtitle">Créez votre compte pour commencer à jouer</p>

        {/* handleSubmit intercepte le submit natif pour valider puis appeler l'API */}
        <form onSubmit={handleSubmit}>
          {/* Champ nom d'utilisateur : input contrôlé lié à l'état nomUtilisateur */}
          <div className="auth-input-group">
            <i className="fa-solid fa-user"></i>
            <input
              type="text"
              placeholder="nom d'utilisateur"
              aria-label="nom d'utilisateur"
              value={nomUtilisateur}
              // met à jour l'état à chaque frappe
              onChange={(e) => setNomUtilisateur(e.target.value)}
              autoComplete="username"
            />
          </div>

          {/* Champ email : le onBlur déclenche la vérification de disponibilité côté serveur */}
          <div className="auth-input-group">
            <i className="fa-solid fa-envelope"></i>
            <input
              type="email"
              placeholder="e-mail"
              aria-label="e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              // appelle /auth/check-email dès que le champ perd le focus
              onBlur={handleEmailBlur}
              autoComplete="email"
            />
          </div>
          {/* Affiché seulement si check-email a trouvé un email déjà utilisé */}
          {emailError && <p className="auth-error">{emailError}</p>}

          {/* Champ mot de passe : saisie masquée (type="password") */}
          <div className="auth-input-group">
            <i className="fa-solid fa-lock"></i>
            <input
              type="password"
              placeholder="mot de passe"
              aria-label="mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // new-password = indique au navigateur de ne pas réutiliser un mot de passe existant
              autoComplete="new-password"
            />
          </div>

          {/* Confirmation du mot de passe : comparée à password dans handleSubmit */}
          <div className="auth-input-group">
            <i className="fa-solid fa-lock"></i>
            <input
              type="password"
              placeholder="confirmer le mot de passe"
              aria-label="confirmer le mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {/* Erreur globale : validation côté client échouée ou réponse d'erreur de l'API */}
          {error && <p className="auth-error">{error}</p>}

          {/* Désactivé pendant l'appel réseau pour éviter une double soumission */}
          <button type="submit" disabled={loading}>
            {loading ? 'Création...' : 'Créer un compte'}
          </button>
        </form>

        {/* Lien vers la page de connexion pour les comptes déjà existants */}
        <p className="auth-footer">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
