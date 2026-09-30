import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import '../css/Sidebar.css'

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'home', end: true },
  { path: '/collection', label: 'Collection', icon: 'book' },
  { path: '/bazaar', label: 'Bazaar', icon: 'shop' },
  { path: '/inventaire', label: 'Inventaire', icon: 'backpack' },
  { path: '/combat', label: 'Combat', icon: 'sword' },
]

function Sidebar({ loggedIn = true, onLogout }) {
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(false)

  // Appliqué sur <html> pour que le thème s'étende à toute la page qui héberge la sidebar
  useEffect(() => {
    document.documentElement.classList.toggle('tcg-dark', dark)
  }, [dark])

  return (
    <aside className={`tcg-sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="tcg-sidebar-header">
        <button
          type="button"
          className="tcg-icon-btn"
          aria-label={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
          onClick={() => setCollapsed((c) => !c)}
        >
          <i className={`fi fi-bs-angle-${collapsed ? 'right' : 'left'}`}></i>
        </button>
      </div>

      {!collapsed && (
        <nav className="tcg-nav">
          <ul className="tcg-menu-list">
            {navItems.map(({ path, label, icon, end }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={end}
                  className={({ isActive }) => (isActive ? 'is-active' : '')}
                >
                  {({ isActive }) => (
                    <>
                      <i className={`fi ${isActive ? 'fi-ss-' : 'fi-rs-'}${icon}`}></i>
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}

            <li>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setDark((d) => !d)
                }}
              >
                <i className={`fi fi-rs-${dark ? 'sun' : 'moon'}`}></i>
                <span>{dark ? 'Thème clair' : 'Thème sombre'}</span>
              </a>
            </li>
          </ul>
        </nav>
      )}

      {!collapsed && loggedIn && (
        <div className="tcg-sidebar-footer">
          <button type="button" className="tcg-logout-btn" onClick={onLogout}>
            <i className="fi fi-rs-sign-out-alt"></i>
            <span>Déconnexion</span>
          </button>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
