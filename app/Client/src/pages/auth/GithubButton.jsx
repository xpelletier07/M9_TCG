import { API_BASE_URL } from '../../config'

// Lien (et non fetch) car le flux OAuth nécessite une navigation complète vers GitHub
export default function GithubButton({ label = 'Continuer avec GitHub' }) {
  return (
    <a className="auth-github-button" href={`${API_BASE_URL}/auth/github`}>
      <i className="fa-brands fa-github"></i> {label}
    </a>
  )
}
