import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { useAuth } from '../auth/AuthContext'

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
    <section className="lg:col-span-8 bg-surface-container-lowest p-lg flex flex-col justify-between">
      <div className="flex justify-between items-start mb-lg">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold uppercase">Drop Commun</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Global Server Supply Drop Event</p>
          <p className="font-label-md text-label-md text-on-surface-variant mt-xs">{cooldownMessage}</p>
        </div>
        <div className="timer-badge">
          <span className="material-symbols-outlined">timer</span>
          <span className="font-mono">{displayedSeconds === null ? '--:--:--' : formatTime(displayedSeconds)}</span>
        </div>
      </div>
      <div className="relative h-48 bg-surface-container overflow-hidden flex items-center justify-center">
        <img alt="Supply Drop Crate" className="absolute inset-0 w-full h-full object-cover opacity-80" src={dropImage} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div className="relative z-10 text-center">
          <div className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-primary font-black uppercase tracking-widest drop-shadow-md">M9 cache</div>
          <div className="font-label-md text-label-md text-on-primary/90 uppercase tracking-widest mt-xs">tier not found</div>
        </div>
      </div>
    </section>
  )
}
