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
  const [dropImage, setDropImage] = useState(FALLBACK_DROP_IMAGE)

  useEffect(() => {
    let intervalId
    let cancelled = false

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

        setRemainingSeconds(data.remainingSeconds)
        setDropImage(data.pack?.image_pack || FALLBACK_DROP_IMAGE)
        const resetAt = new Date(data.resetAt).getTime()

        window.clearInterval(intervalId)
        intervalId = window.setInterval(() => {
          const nextRemaining = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))

          if (nextRemaining <= 0) {
            window.clearInterval(intervalId)
            loadDropState()
            return
          }

          setRemainingSeconds(nextRemaining)
        }, 1000)
      } catch (error) {
        if (!cancelled) {
          // Fallback calculé en local sur un cycle de 5 minutes
          const cycleSeconds = 5 * 60
          const nowSeconds = Math.floor(Date.now() / 1000)
          const fallbackRemaining = cycleSeconds - (nowSeconds % cycleSeconds)
          setRemainingSeconds(fallbackRemaining)
          setDropImage(FALLBACK_DROP_IMAGE)

          window.clearInterval(intervalId)
          intervalId = window.setInterval(() => {
            const currentSeconds = Math.floor(Date.now() / 1000)
            setRemainingSeconds(cycleSeconds - (currentSeconds % cycleSeconds))
          }, 1000)
        }
      }
    }

    loadDropState()

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
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
    </section>
  )
}
