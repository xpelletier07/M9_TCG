import { Link } from 'react-router-dom'

export default function TopAppBar() {
  return (
    <header className="dashboard-topbar">
      <Link className="dashboard-topbar-brand" to="/">M9 <span>TCG</span></Link>
      <span className="dashboard-topbar-caption">Votre espace de jeu</span>
      <Link className="dashboard-topbar-account" to="/settings" aria-label="Paramètres du compte">
        <i className="fa-regular fa-user" aria-hidden="true" />
      </Link>
    </header>
  )
}
