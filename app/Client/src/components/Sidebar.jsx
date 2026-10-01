import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import '../css/Sidebar.css'

// Liste des liens de navigation ; `end` force NavLink à ne matcher "/" que sur une correspondance exacte
const navItems = [
  { path: '/', label: 'Dashboard', icon: 'home', end: true },
  { path: '/collection', label: 'Collection', icon: 'book' },
  { path: '/bazaar', label: 'Bazaar', icon: 'shop' },
  { path: '/inventaire', label: 'Inventaire', icon: 'backpack' },
  { path: '/combat', label: 'Combat', icon: 'sword' },
]

function Sidebar({ loggedIn = true, onLogout }) {
  // `collapsed` replie la sidebar en icônes seules ; `dark` bascule le thème sombre
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(false)

  // Appliqué sur <html> pour que le thème s'étende à toute la page qui héberge la sidebar
  // On gère à la fois la classe personnalisée 'tcg-dark' et l'attribut 'data-theme' de Bulma
  useEffect(() => {
    document.documentElement.classList.toggle('tcg-dark', dark)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

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

      {/* Bouton de déconnexion : visible seulement si connecté et sidebar dépliée ; onLogout vient d'AppLayout */}
      {!collapsed && loggedIn && (
        <div className="tcg-sidebar-footer">
          {/* onLogout appelle logout() du AuthContext puis redirige vers /login */}
          <button type="button" className="tcg-logout-btn" onClick={onLogout}>
            <i className="fa-solid fa-right-from-bracket"></i>
            <span>Déconnexion</span>
          </button>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
