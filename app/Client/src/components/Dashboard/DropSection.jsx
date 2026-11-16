import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '../../config'
import { useAuth } from '../../auth/AuthContext'

const FALLBACK_DROP_IMAGE = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80'

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

export default function DropSection(){
  const { token } = useAuth()
  const navigate = useNavigate()
  const [remainingSeconds, setRemainingSeconds] = useState(null)
  const [dropImage, setDropImage] = useState(FALLBACK_DROP_IMAGE)
  const [isClaimReady, setIsClaimReady] = useState(false)
  const [isCooldownActive, setIsCooldownActive] = useState(false)
  const [statusError, setStatusError] = useState(false)

  useEffect(() => {
    let intervalId
    let pollId
    let cancelled = false
    let socket = null

    async function loadDropState() {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const response = await fetch(`${API_BASE_URL}/inventaire-pack/drop-state`, { headers })
        if (!response.ok) {
          throw new Error('Impossible de récupérer le drop')
        }

        const data = await response.json()
        if (cancelled) {
          return
        }

        const remaining = Math.max(0, data.remainingSeconds ?? 0)
        const canUserClaim = data.canClaim !== undefined ? Boolean(data.canClaim) : (data.isClaimReady !== undefined ? Boolean(data.isClaimReady) : remaining <= 0)
        const claimReady = canUserClaim && remaining <= 0
        const cooldownActive = Boolean(data.isCooldownActive ?? (remaining > 0))
        const deadline = cooldownActive ? data.resetAt : data.claimClosesAt
        const displayedRemaining = cooldownActive ? remaining : Math.max(0, data.claimRemainingSeconds ?? 0)

        setRemainingSeconds(displayedRemaining)
        setIsCooldownActive(cooldownActive)
        setStatusError(false)
        setDropImage(FALLBACK_DROP_IMAGE)
        setIsClaimReady(claimReady)

        window.clearInterval(intervalId)

        if (displayedRemaining > 0 && deadline) {
          const resetAt = new Date(deadline).getTime()
          intervalId = window.setInterval(() => {
            const nextRemaining = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))
            setRemainingSeconds(nextRemaining)

            if (nextRemaining <= 0) {
              setIsClaimReady(false)
              window.clearInterval(intervalId)
              loadDropState()
            }
          }, 1000)
        }
      } catch {
        if (!cancelled) {
          window.clearInterval(intervalId)
          setRemainingSeconds(null)
          setIsClaimReady(false)
          setStatusError(true)
        }
      }
    }

    loadDropState()

    try {
      socket = io(API_BASE_URL)
      socket.on('drop:updated', () => {
        loadDropState()
      })
    } catch {
      // fallback to poll
    }

    pollId = window.setInterval(loadDropState, 1500)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.clearInterval(pollId)
      if (socket) {
        socket.disconnect()
      }
    }
  }, [token])

  return (
    <section className="dashboard-panel dashboard-drop">
      <div className="dashboard-panel-header">
        <div>
          <span className="dashboard-kicker">Global Server Supply Drop Event</span>
          <h2 className="dashboard-title">Drop Commun</h2>
          <p className="dashboard-meta">Drop de cartes toutes les 5 minutes</p>
        </div>
        <div className="dashboard-timer">
          <i className="fa-solid fa-hourglass-half" aria-hidden="true"></i>
          <span>{statusError ? 'Temps indisponible' : <>{isCooldownActive ? 'Prochain claim' : 'Fermeture du claim'}<br />{remainingSeconds === null ? '--:--:--' : formatTime(remainingSeconds)}</>}</span>
        </div>
      </div>
      <div className="dashboard-hero">
        <img alt="Univers de jeu du tirage commun" src={dropImage} />
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-label">CHOISISSEZ VOTRE PROCHAINE CARTE</span>
          <div className="dashboard-hero-title">Trois possibilités.<br />Un seul choix.</div>
          <div className="dashboard-hero-subtitle">À chaque tirage, une nouvelle chance d’enrichir votre collection.</div>
        </div>
      </div>

        <div className="dashboard-drop-footer">
          <p className="dashboard-meta">{!token ? 'Connectez-vous pour participer au tirage.' : isClaimReady ? 'Le tirage est disponible. Faites votre choix !' : 'Votre prochain tirage se prépare.'}</p>
          <button
            type="button"
            className="dashboard-primary-button"
            disabled={!token || !isClaimReady}
            onClick={() => navigate('/claim-carte')}
          >
            Claim carte
          </button>
        </div>
    </section>
  )
}
