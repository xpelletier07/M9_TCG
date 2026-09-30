import React, { useEffect, useState } from 'react'
import { API_BASE_URL } from '../../config'
import { useAuth } from '../../auth/AuthContext'

const getPackImageUrl = (imagePath) => {
  if (!imagePath) return '/images/pack-default.png'

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath
  }

  const normalized = imagePath.trim().replace(/^\.\//, '/').replace(/\\/g, '/')

  if (normalized.startsWith('/')) {
    return normalized
  }

  if (normalized.startsWith('images/')) {
    return `/${normalized}`
  }

  return `/${normalized}`
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

export default function BoosterPack() {
  const { token } = useAuth()
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [isOpening, setIsOpening] = useState(false)
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(null)
  const [inventoryCount, setInventoryCount] = useState(0)
  const [feedback, setFeedback] = useState(null)

  // Chargement des packs actifs
  useEffect(() => {
    let cancelled = false

    const fetchPacks = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/pack`)
        if (!response.ok) {
          throw new Error('Failed to load packs')
        }

        const data = await response.json()
        const activePacks = (Array.isArray(data) ? data : []).filter((p) => p?.actif !== false)
        if (!cancelled) {
          setPacks(activePacks)
        }
      } catch (error) {
        console.error('Erreur lors du chargement des packs:', error)
        if (!cancelled) {
          setPacks([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchPacks()

    return () => {
      cancelled = true
    }
  }, [])

  const pack = packs[0]

  // Chargement du statut personnel (cooldown 24h & inventaire de pack)
  useEffect(() => {
    let cancelled = false
    let intervalId = null

    if (!token) {
      setCooldownRemainingSeconds(null)
      setInventoryCount(0)
      return
    }

    const fetchPackStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/inventaire-pack/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Impossible de charger le statut du pack')
        }

        const data = await response.json()
        if (cancelled) return

        const initialCooldown = data.cooldownRemainingSeconds ?? 0
        setCooldownRemainingSeconds(initialCooldown)

        // Récupérer la quantité possédée pour ce pack
        if (pack && Array.isArray(data.inventory)) {
          const userItem = data.inventory.find((item) => item.id_pack === pack.id_pack)
          setInventoryCount(userItem ? userItem.quantite : 0)
        }

        // Démarrer le décompte si cooldown actif
        const cooldownResetAt = data.cooldownResetAt
          ? new Date(data.cooldownResetAt).getTime()
          : null

        if (initialCooldown > 0) {
          window.clearInterval(intervalId)
          intervalId = window.setInterval(() => {
            if (cooldownResetAt) {
              const remaining = Math.max(0, Math.ceil((cooldownResetAt - Date.now()) / 1000))
              setCooldownRemainingSeconds(remaining)
              if (remaining <= 0) {
                window.clearInterval(intervalId)
              }
            } else {
              setCooldownRemainingSeconds((prev) => {
                if (!prev || prev <= 1) {
                  window.clearInterval(intervalId)
                  return 0
                }
                return prev - 1
              })
            }
          }, 1000)
        }
      } catch (error) {
        console.error('Erreur statut pack:', error)
      }
    }

    fetchPackStatus()

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [token, pack?.id_pack])

  // Clic sur "Open Pack" pour réclamer le pack (cooldown 24h)
  const handleOpenPack = async () => {
    if (!token) {
      setFeedback({ type: 'error', message: 'Veuillez vous connecter pour réclamer un pack.' })
      return
    }

    if (cooldownRemainingSeconds > 0 || isOpening || !pack) {
      return
    }

    setIsOpening(true)
    setFeedback(null)

    try {
      const response = await fetch(`${API_BASE_URL}/inventaire-pack/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id_pack: pack.id_pack }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.cooldownRemainingSeconds !== undefined) {
          setCooldownRemainingSeconds(data.cooldownRemainingSeconds)
        }
        setFeedback({
          type: 'error',
          message: data.error || "Erreur lors de l'ouverture du pack",
        })
        return
      }

      setInventoryCount(data.quantite ?? (inventoryCount + 1))
      setCooldownRemainingSeconds(data.cooldownRemainingSeconds ?? 24 * 3600)
      setFeedback({
        type: 'success',
        message: 'Pack réclamé avec succès ! Prochain pack dans 24h.',
      })
    } catch (error) {
      console.error("Erreur lors de l'ouverture du pack :", error)
      setFeedback({ type: 'error', message: "Erreur réseau lors de l'ouverture du pack." })
    } finally {
      setIsOpening(false)
    }
  }

  const isCooldownActive = cooldownRemainingSeconds !== null && cooldownRemainingSeconds > 0
  const isButtonDisabled = loading || isOpening || !pack || !token || isCooldownActive

  return (
    <section className="dashboard-panel dashboard-booster">
      <div className="dashboard-badge">
        <span>
          {loading
            ? 'Loading'
            : !token
            ? '1 Pack / 24h'
            : isCooldownActive
            ? 'Veuillez patienter avant de réclamer un nouveau pack'
            : 'Prêt à ouvrir !'}
        </span>
      </div>

      <div className="dashboard-pack-image">
        <img
          alt={pack?.nom_pack || 'Booster Pack'}
          className="w-full h-full object-cover"
          src={getPackImageUrl(pack?.image_pack)}
        />
      </div>

      <h3 className="dashboard-booster-title">
        {pack?.nom_pack || 'Set not found yet'}
      </h3>

      <p className="dashboard-booster-description">
        {pack?.description_pack || 'Could not find a matching set for this booster pack.'}
      </p>

      <button
        className="dashboard-open-pack"
        disabled={isButtonDisabled}
        onClick={handleOpenPack}
      >
        {isOpening ? (
          <span>Ouverture en cours...</span>
        ) : !token ? (
          <span>Connexion requise</span>
        ) : isCooldownActive ? (
          <span>{`Disponible dans ${formatTime(cooldownRemainingSeconds)}`}</span>
        ) : (
          <>
            <span>Open Pack</span>
            <i className="fa-solid fa-box-open" aria-hidden="true"></i>
          </>
        )}
      </button>

      {feedback && (
        <p
          className="dashboard-meta"
          style={{
            marginTop: '0.6rem',
            fontWeight: '600',
            color: feedback.type === 'success' ? '#2ec4b6' : '#e71d36',
          }}
        >
          {feedback.message}
        </p>
      )}

      <div className="dashboard-inventory">
        {token
          ? `Inventaire : ${inventoryCount} pack${inventoryCount > 1 ? 's' : ''}`
          : 'Inventaire : none'}
      </div>
      <p className="dashboard-meta" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
        1 pack réclamable toutes les 24h
      </p>
    </section>
  )
}
