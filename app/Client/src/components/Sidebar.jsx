import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { API_BASE_URL } from '../config.js'
import '../css/Sidebar.css'

// Liste des liens de navigation ; `end` force NavLink à ne matcher "/" que sur une correspondance exacte
const navItems = [
  { path: '/', label: 'Dashboard', icon: 'home', end: true },
  { path: '/collection', label: 'Collection', icon: 'book' },
  { path: '/bazaar', label: 'Bazaar', icon: 'shop' },
  { path: '/inventaire', label: 'Inventaire', icon: 'backpack' },
  { path: '/combat', label: 'Combat', icon: 'sword' },
]

function Sidebar({ loggedIn = true, onLogout, user: propUser }) {
  // `collapsed` replie la sidebar en icônes seules ; `dark` bascule le thème sombre
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('tcg-theme') === 'dark' || document.documentElement.classList.contains('tcg-dark')
  })

  // Récupération de l'utilisateur et du token JWT depuis le contexte global (AuthContext).
  // Le bloc try/catch garantit que le composant ne plantera pas s'il est testé ou monté hors du AuthProvider.
  let authUser = null
  let authToken = null
  try {
    const auth = useAuth()
    authUser = auth?.user
    authToken = auth?.token
  } catch {
    // Si Sidebar est utilisé hors AuthProvider, on continue avec les valeurs par défaut
  }

  // État local 'userData' initialisé avec l'utilisateur issu des props ou du contexte d'authentification.
  // Permet un affichage immédiat sans scintillement (données en cache du localStorage).
  const initialUser = propUser || authUser
  const [userData, setUserData] = useState(initialUser)

  // Met à jour 'userData' si l'utilisateur change dans le AuthContext ou les props (ex: connexion/déconnexion).
  useEffect(() => {
    if (propUser || authUser) {
      setUserData(propUser || authUser)
    }
  }, [propUser, authUser])

  // Effet pour récupérer les données fraîches de l'utilisateur (notamment le solde de crédits en base de données).
  // La route /auth/whoAmI renvoie l'enregistrement complet de la table 'utilisateurs' pour l'id connecté.
  useEffect(() => {
    if (!authToken) return
    let isMounted = true

    async function fetchUserProfile() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/whoAmI`, {
          headers: { Authorization: `Bearer ${authToken}` }
        })
        if (response.ok) {
          const data = await response.json()
          // 'isMounted' évite de mettre à jour le state si le composant a été démonté entre-temps
          if (isMounted && data) {
            setUserData((prev) => ({ ...prev, ...data }))
          }
        }
      } catch (err) {
        console.error('Erreur lors de la récupération du profil:', err)
      }
    }

    // Premier appel au montage du composant
    fetchUserProfile()

    // Fonction de rafraîchissement réutilisable
    function handleRefresh() {
      fetchUserProfile()
    }

    // Écouteurs d'événements pour garder les crédits synchronisés :
    // 1. 'focus' : lorsque l'utilisateur revient sur l'onglet du navigateur
    // 2. 'credits-updated' : événement personnalisé déclenché lors d'un achat, gain ou échange de crédits
    window.addEventListener('focus', handleRefresh)
    window.addEventListener('credits-updated', handleRefresh)
    window.addEventListener('user-updated', handleRefresh)

    // Nettoyage lors du démontage pour prévenir les fuites de mémoire
    return () => {
      isMounted = false
      window.removeEventListener('focus', handleRefresh)
      window.removeEventListener('credits-updated', handleRefresh)
      window.removeEventListener('user-updated', handleRefresh)
    }
  }, [authToken])

  // Appliqué sur <html> pour que le thème s'étende à toute la page qui héberge la sidebar
  // On gère à la fois la classe personnalisée 'tcg-dark' et l'attribut 'data-theme' de Bulma
  useEffect(() => {
    document.documentElement.classList.toggle('tcg-dark', dark)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('tcg-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Écoute les changements de thème déclenchés depuis d'autres composants (ex: page Settings)
  useEffect(() => {
    function handleThemeChange(e) {
      const isDark = e?.detail !== undefined
        ? Boolean(e.detail)
        : (localStorage.getItem('tcg-theme') === 'dark' || document.documentElement.classList.contains('tcg-dark'))
      setDark(isDark)
    }
    window.addEventListener('tcg-theme-change', handleThemeChange)
    return () => window.removeEventListener('tcg-theme-change', handleThemeChange)
  }, [])

  // Détermine si l'utilisateur est connecté et prépare les variables d'affichage sécurisées avec valeurs de repli
  const isUserLoggedIn = loggedIn && Boolean(userData || authUser || authToken)
  const username = userData?.nom_utilisateur || userData?.username || 'Joueur'
  const credits = userData?.credits !== undefined && userData?.credits !== null
    ? userData.credits
    : 0
  const avatarUrl = userData?.avatar_url || userData?.avatar || null

  return (
    // La classe "collapsed" rétrécit la sidebar (gérée en CSS) selon l'état local
    <aside className={`tcg-sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="tcg-sidebar-header">
        {/* Bouton qui replie/déplie la sidebar */}
        <button
          type="button"
          className="tcg-icon-btn"
          // aria-label dynamique pour que les lecteurs d'écran annoncent l'action réelle du bouton
          aria-label={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
          onClick={() => setCollapsed((c) => !c)}
        >
          {/* Icône change de sens selon l'état replié/déplié */}
          <i className={`fa-solid fa-angle-${collapsed ? 'right' : 'left'}`}></i>
        </button>
      </div>

      {/* Le menu entier est caché (pas juste réduit) quand la sidebar est repliée */}
      {!collapsed && (
        <nav className="tcg-nav">
          <ul className="tcg-menu-list">
            {/* Génère un NavLink par entrée de navItems ; la classe is-active vient de react-router (isActive) */}
            {navItems.map(({ path, label, icon, end }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  // end: évite que "/" reste actif sur toutes les sous-routes
                  end={end}
                  className={({ isActive }) => (isActive ? 'is-active' : '')}
                >
                  {/* NavLink fournit isActive en render-prop ; ici non utilisé mais dispo pour du style conditionnel */}
                  {({ isActive }) => (
                    <>
                      <i className={`fa-solid fa-${icon}`}></i>
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}

            {/* Bascule le thème clair/sombre (pas un lien de navigation, juste une action locale) */}
            <li>
              <a
                href="#"
                onClick={(e) => {
                  // empêche la navigation du lien "#" (href factice)
                  e.preventDefault()
                  setDark((d) => !d)
                }}
              >
                {/* Icône et texte reflètent le thème actuel, pas celui vers lequel on bascule */}
                <i className={`fa-solid fa-${dark ? 'sun' : 'moon'}`}></i>
                <span>{dark ? 'Thème clair' : 'Thème sombre'}</span>
              </a>
            </li>
          </ul>
        </nav>
      )}

      {/* ── Bas de la sidebar : Carte profil utilisateur et bouton d'engrenage vers la page Paramètres ── */}
      {/* Affiché uniquement si l'utilisateur est authentifié */}
      {isUserLoggedIn && (
        <div className="tcg-sidebar-footer">
          {/* Version compacte lorsque la sidebar est repliée (largeur 52px) :
              Affiche uniquement l'avatar circulaire sous forme de lien direct vers /settings */}
          {collapsed ? (
            <NavLink
              to="/settings"
              className={({ isActive }) => `tcg-sidebar-collapsed-profile${isActive ? ' is-active' : ''}`}
              title={`Paramètres - ${username}`}
              aria-label="Accéder aux paramètres"
            >
              <div className="tcg-user-avatar compact">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={username} className="tcg-user-avatar-img" />
                ) : (
                  <i className="fa-solid fa-user"></i>
                )}
              </div>
            </NavLink>
          ) : (
            /* Version dépliée (croquis demandé) : carte avec Avatar + Username/Crédits + Bouton engrenage */
            <div className="tcg-user-card">
              {/* Cercle photo de profil : affiche l'image d'avatar ou une icône FontAwesome en repli */}
              <div className="tcg-user-avatar" title={username}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={username} className="tcg-user-avatar-img" />
                ) : (
                  <i className="fa-solid fa-user"></i>
                )}
              </div>

              {/* Bloc central : nom d'utilisateur (ligne 1) et solde de crédits (ligne 2) */}
              <div className="tcg-user-info">
                {/* Nom d'utilisateur avec troncature automatique (ellipsis) en cas de texte trop long */}
                <span className="tcg-user-name" title={username}>
                  {username}
                </span>
                {/* Nombre de crédits avec icône de pièce dorée et formatage des milliers en français */}
                <span className="tcg-user-credits" title={`${Number(credits).toLocaleString('fr-FR')} crédits`}>
                  <i className="fa-solid fa-coins tcg-credits-icon"></i>
                  <span>{Number(credits).toLocaleString('fr-FR')} crédits</span>
                </span>
              </div>

              {/* Bouton d'engrenage redirigeant vers la page Settings.jsx via le routeur */}
              <NavLink
                to="/settings"
                className={({ isActive }) => `tcg-settings-btn${isActive ? ' is-active' : ''}`}
                title="Paramètres"
                aria-label="Accéder aux paramètres"
              >
                <i className="fa-solid fa-gear"></i>
              </NavLink>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

export default Sidebar
