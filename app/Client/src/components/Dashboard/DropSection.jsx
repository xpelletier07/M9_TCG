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

        setRemainingSeconds(remaining)
        setDropImage(FALLBACK_DROP_IMAGE)
        setIsClaimReady(claimReady)

        window.clearInterval(intervalId)

        if (!claimReady && remaining > 0 && data.resetAt) {
          const resetAt = new Date(data.resetAt).getTime()
          intervalId = window.setInterval(() => {
            const nextRemaining = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))
            setRemainingSeconds(nextRemaining)

            if (nextRemaining <= 0) {
              setIsClaimReady(true)
              window.clearInterval(intervalId)
              loadDropState()
            }
          }, 1000)
        }
      } catch (error) {
        if (!cancelled) {
          // Fallback calculé en local sur un cycle de 5 minutes
          const cycleSeconds = 5 * 60
          const nowSeconds = Math.floor(Date.now() / 1000)
          const fallbackRemaining = cycleSeconds - (nowSeconds % cycleSeconds)
          setRemainingSeconds(fallbackRemaining)
          setDropImage(FALLBACK_DROP_IMAGE)
          setIsClaimReady(fallbackRemaining <= 0)

          window.clearInterval(intervalId)
          intervalId = window.setInterval(() => {
            const currentSeconds = Math.floor(Date.now() / 1000)
            const nextRemaining = cycleSeconds - (currentSeconds % cycleSeconds)
            setRemainingSeconds(nextRemaining)

            if (nextRemaining <= 0) {
              setIsClaimReady(true)
              window.clearInterval(intervalId)
              loadDropState()
            }
          }, 1000)
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
          <h2 className="dashboard-title">Drop Commun</h2>
          <p className="dashboard-eyebrow">Global Server Supply Drop Event</p>
          <p className="dashboard-meta">Drop de cartes toutes les 5 minutes</p>
        </div>
        <div className="dashboard-timer">
          <i className="fa-solid fa-hourglass-half" aria-hidden="true"></i>
          <span>{remainingSeconds === null ? '--:--:--' : formatTime(remainingSeconds)}</span>
        </div>
      </div>
      <div className="dashboard-hero">
        <img alt="Supply Drop Crate" src={dropImage} />
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-title">M9 cache</div>
          <div className="dashboard-hero-subtitle">tier not found</div>
        </div>
      </div>

      {isClaimReady && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            className="button is-warning"
            onClick={() => navigate('/claim-carte')}
          >
            Claim maintenant
          </button>
        </div>
      )}
    </section>
  )
}
