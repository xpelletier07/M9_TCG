import React, { useEffect, useState } from 'react'

const API_URL = 'http://localhost:3000'

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

export default function BoosterPack() {
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPacks = async () => {
      try {
        const response = await fetch(`${API_URL}/pack`)
        if (!response.ok) {
          throw new Error('Failed to load packs')
        }

        const data = await response.json()
        const activePacks = (Array.isArray(data) ? data : []).filter((pack) => pack?.actif !== false)
        setPacks(activePacks)
      } catch (error) {
        console.error('Erreur lors du chargement des packs:', error)
        setPacks([])
      } finally {
        setLoading(false)
      }
    }

    fetchPacks()
  }, [])

  const pack = packs[0]

  return (
    <section className="dashboard-panel dashboard-booster">
      <div className="dashboard-badge">
        <span>
          {loading ? 'Loading' : 'New Series'}
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

      <button className="dashboard-open-pack" disabled={loading || !pack}>
        <span>Open Pack</span>
        <i className="fa-solid fa-box-open" aria-hidden="true"></i>
      </button>

      <div className="dashboard-inventory">
        {pack ? `Inventory: ${Array.isArray(pack.liste_carte) ? pack.liste_carte.length : 0}` : 'Inventory: none'}
      </div>
    </section>
  )
}
