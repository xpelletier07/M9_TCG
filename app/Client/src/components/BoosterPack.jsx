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
    <section className="lg:col-span-4 bg-surface-container-lowest p-lg flex flex-col items-center text-center justify-center relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-sm">
        <span className="bg-tertiary-container text-on-tertiary font-label-sm text-label-sm px-sm py-xs uppercase">
          {loading ? 'Loading' : 'New Series'}
        </span>
      </div>

      <div className="w-40 h-56 bg-surface-container mb-lg mt-md transform transition-transform group-hover:scale-105 duration-300 tcg-border-active shadow-lg relative">
        <img
          alt={pack?.nom_pack || 'Booster Pack'}
          className="w-full h-full object-cover"
          src={getPackImageUrl(pack?.image_pack)}
        />
      </div>

      <h3 className="font-headline-md text-headline-md text-on-surface font-bold uppercase mb-xs">
        {pack?.nom_pack || 'Set not found yet'}
      </h3>

      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        {pack?.description_pack || 'Could not find a matching set for this booster pack.'}
      </p>

      <button className="open-pack-btn w-full" disabled={loading || !pack}>
        <span>Open Pack</span>
        <span className="material-symbols-outlined">unarchive</span>
      </button>

      <div className="font-label-sm text-label-sm text-on-surface-variant mt-sm">
        {pack ? `Inventory: ${Array.isArray(pack.liste_carte) ? pack.liste_carte.length : 0}` : 'Inventory: none'}
      </div>
    </section>
  )
}
