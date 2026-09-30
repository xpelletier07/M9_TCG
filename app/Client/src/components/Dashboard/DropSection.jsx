import { useEffect, useState } from 'react'
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
  const [remainingSeconds, setRemainingSeconds] = useState(null)
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(null)
  const [dropImage, setDropImage] = useState(FALLBACK_DROP_IMAGE)

  useEffect(() => {
    let intervalId
    let heartbeatId
    let cancelled = false

    async function loadDropState() {
      if (!token) {
        setRemainingSeconds(null)
        setCooldownRemainingSeconds(null)
        setDropImage(FALLBACK_DROP_IMAGE)
        return
      }

      try {
        const response = await fetch(`${API_BASE_URL}/inventaire-pack/drop-state`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!response.ok) {
          throw new Error('Impossible de récupérer le drop')
        }

        const data = await response.json()
        if (cancelled) {
          return
        }

        setRemainingSeconds(data.remainingSeconds)
        setCooldownRemainingSeconds(data.cooldownRemainingSeconds ?? 0)
        setDropImage(data.pack?.image_pack || FALLBACK_DROP_IMAGE)
        const resetAt = new Date(data.resetAt).getTime()
        const cooldownResetAt = data.cooldownResetAt
          ? new Date(data.cooldownResetAt).getTime()
          : null

        window.clearInterval(intervalId)
        intervalId = window.setInterval(() => {
          const nextRemaining = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))
          const nextCooldownRemaining = cooldownResetAt
            ? Math.max(0, Math.ceil((cooldownResetAt - Date.now()) / 1000))
            : 0

          setCooldownRemainingSeconds(nextCooldownRemaining)

          if (nextRemaining <= 0) {
            window.clearInterval(intervalId)
            loadDropState()
            return
          }

          setRemainingSeconds(nextRemaining)
        }, 1000)
      } catch (error) {
        if (!cancelled) {
          setRemainingSeconds(null)
          setCooldownRemainingSeconds(null)
          setDropImage(FALLBACK_DROP_IMAGE)
        }
      }
    }

    async function sendHeartbeat() {
      if (!token) {
        return
      }

      try {
        await fetch(`${API_BASE_URL}/inventaire-pack/heartbeat`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      } catch {
        // L'affichage continue même si un heartbeat échoue ponctuellement.
      }
    }

    loadDropState()
    sendHeartbeat()
    heartbeatId = window.setInterval(sendHeartbeat, 30000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.clearInterval(heartbeatId)
    }
  }, [token])

  const displayedSeconds = cooldownRemainingSeconds > 0
    ? cooldownRemainingSeconds
    : remainingSeconds
  const cooldownMessage = cooldownRemainingSeconds === null
    ? 'Disponibilité du pack en cours de chargement'
    : cooldownRemainingSeconds > 0
      ? `Prochain pack personnel dans ${formatTime(cooldownRemainingSeconds)}`
      : 'Pack personnel disponible'

  return (
    <section className="dashboard-panel dashboard-drop">
      <div className="dashboard-panel-header">
        <div>
          <h2 className="dashboard-title">Drop Commun</h2>
          <p className="dashboard-eyebrow">Global Server Supply Drop Event</p>
          <p className="dashboard-meta">{cooldownMessage}</p>
        </div>
        <div className="dashboard-timer">
          <i className="fa-solid fa-hourglass-half" aria-hidden="true"></i>
          <span>{displayedSeconds === null ? '--:--:--' : formatTime(displayedSeconds)}</span>
        </div>
      </div>
      <div className="dashboard-hero">
        <img alt="Supply Drop Crate" src={dropImage} />
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-title">M9 cache</div>
          <div className="dashboard-hero-subtitle">tier not found</div>
        </div>
      </div>
    </section>
  )
}
