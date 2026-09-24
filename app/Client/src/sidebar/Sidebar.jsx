import { useEffect, useState } from 'react'
import '../css/Sidebar.css'

const navItems = [
  { key: 'accueil', label: 'Dashboard', icon: 'home' },
  { key: 'catalogue', label: 'Catalogue', icon: 'book' },
  { key: 'bazaar', label: 'Bazaar', icon: 'shop' },
  { key: 'inventaire', label: 'Inventaire', icon: 'backpack' },
  { key: 'combat', label: 'Combat', icon: 'sword' },
]

function Sidebar({ currentPage, onNavigate, loggedIn = true, onLogout }) {
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
            {navItems.map(({ key, label, icon }) => {
              const isActive = currentPage === key
              return (
                <li key={key}>
                  <a
                    href="#"
                    className={isActive ? 'is-active' : ''}
                    onClick={(e) => {
                      e.preventDefault()
                      onNavigate?.(key)
                    }}
                  >
                    <i className={`fi ${isActive ? 'fi-ss-' : 'fi-rs-'}${icon}`}></i>
                    <span>{label}</span>
                  </a>
                </li>
              )
            })}

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
