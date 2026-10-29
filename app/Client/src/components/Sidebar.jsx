import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { API_BASE_URL } from '../config.js'
import '../css/Sidebar.css'

// Liste des liens de navigation avec des icônes FontAwesome valides
const navItems = [
  { path: '/', label: 'Dashboard', icon: 'house', end: true },
  { path: '/collection', label: 'Collection', icon: 'book-open' },
  { path: '/bazaar', label: 'Bazaar', icon: 'store' },
  { path: '/inventaire', label: 'Inventaire', icon: 'box-archive' },
  { path: '/combat', label: 'Combat', icon: 'khanda' },
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
      {/* ── En-tête : Emblème & Titre du jeu M9 TCG + Bouton replier ── */}
      <div className="tcg-sidebar-header">
        <NavLink to="/" className="tcg-sidebar-brand" title="M9 TCG - Accueil">
          <div className="tcg-brand-badge">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          {!collapsed && (
            <div className="tcg-brand-info">
              <span className="tcg-brand-title">M9 <span className="tcg-brand-accent">TCG</span></span>
              <span className="tcg-brand-subtitle">CARD ARENA</span>
            </div>
          )}
        </NavLink>

        {/* Bouton pour replier / déplier */}
        <button
          type="button"
          className="tcg-icon-btn tcg-collapse-btn"
          aria-label={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
          title={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
          onClick={() => setCollapsed((c) => !c)}
        >
          <i className={`fa-solid fa-angle-${collapsed ? 'right' : 'left'}`}></i>
        </button>
      </div>

      {/* ── Navigation principale (icônes toujours visibles même repliée) ── */}
      <nav className="tcg-nav">
        {!collapsed && <div className="tcg-nav-section-title">NAVIGATION</div>}
        <ul className="tcg-menu-list">
          {navItems.map(({ path, label, icon, end }) => (
            <li key={path}>
              <NavLink
                to={path}
                end={end}
                className={({ isActive }) => (isActive ? 'is-active' : '')}
                title={label}
              >
                <span className="tcg-nav-icon-wrap">
                  <i className={`fa-solid fa-${icon}`}></i>
                </span>
                {!collapsed && <span className="tcg-nav-label">{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Bas de la sidebar : Fiche duelliste / Joueur & Paramètres ── */}
      {isUserLoggedIn && (
        <div className="tcg-sidebar-footer">
          {collapsed ? (
            <NavLink
              to="/settings"
              className={({ isActive }) => `tcg-sidebar-collapsed-profile${isActive ? ' is-active' : ''}`}
              title={`Duelliste : ${username} • ${Number(credits).toLocaleString('fr-FR')} crédits (Paramètres)`}
              aria-label="Accéder aux paramètres du joueur"
            >
              <div className="tcg-user-avatar compact">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={username} className="tcg-user-avatar-img" />
                ) : (
                  <i className="fa-solid fa-user-large"></i>
                )}
                <span className="tcg-online-dot" title="En ligne"></span>
              </div>
            </NavLink>
          ) : (
            <div className="tcg-user-card">
              <div className="tcg-user-avatar" title={username}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={username} className="tcg-user-avatar-img" />
                ) : (
                  <i className="fa-solid fa-user-large"></i>
                )}
                <span className="tcg-online-dot" title="En ligne"></span>
              </div>

              <div className="tcg-user-info">
                <span className="tcg-user-name" title={username}>
                  {username}
                </span>
                <span className="tcg-user-credits" title={`${Number(credits).toLocaleString('fr-FR')} crédits`}>
                  <i className="fa-solid fa-coins tcg-credits-icon"></i>
                  <span>{Number(credits).toLocaleString('fr-FR')}</span>
                  <span className="tcg-credits-label">cr.</span>
                </span>
              </div>

              <NavLink
                to="/settings"
                className={({ isActive }) => `tcg-settings-btn${isActive ? ' is-active' : ''}`}
                title="Paramètres du jeu"
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
