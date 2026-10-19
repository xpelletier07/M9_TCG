import { useEffect, useState } from 'react'
import Card from '../components/Card'
import { useAuth } from '../auth/AuthContext'
import { API_BASE_URL } from '../config'
import '../css/InventoryCards.css'

const rarityMeta = {
    1: { label: 'Commun', chance: '70%' },
    2: { label: 'Rare', chance: '20%' },
    3: { label: 'Épique', chance: '9%' },
    4: { label: 'Légendaire', chance: '1%' },
}

function ClaimCarte() {
    const { token } = useAuth()
    const [selectedCards, setSelectedCards] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let isMounted = true

        async function fetchCards() {
            try {
                setLoading(true)
                setError('')

                const response = await fetch(`${API_BASE_URL}/cards/random?count=3`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(errorText || 'Impossible de charger les cartes')
                }

                const data = await response.json()

                if (!isMounted) {
                    return
                }

                setSelectedCards(Array.isArray(data) ? data : [])
            } catch (fetchError) {
                if (!isMounted) {
                    return
                }

                setError(fetchError.message)
                setSelectedCards([])
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        fetchCards()

        return () => {
            isMounted = false
        }
    }, [token])

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ marginBottom: '0.5rem' }}>Claim Your Cards</h1>
                <p style={{ margin: 0 }}>
                    Veillez sélectionner les cartes que vous souhaitez réclamer. Vous pouvez choisir une carte parmi
                    3 cartes proposées.
                </p>
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : error ? (
                <p>{error}</p>
            ) : (
                <>
                    <div className="inventory-cards-grid">
                        {selectedCards.map((carte, index) => (
                            <div
                                key={carte.id_carte}
                                style={{ animation: `claim-card-enter 420ms ease ${index * 120}ms both` }}
                            >
                                <div style={{ marginBottom: '0.75rem', fontWeight: 700 }}>
                                    {rarityMeta[carte.rarete]?.label ?? 'Carte'} - {rarityMeta[carte.rarete]?.chance ?? '0%'}
                                </div>
                                <Card carte={carte} onClick={() => {}} />
                                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
                                    <button type="button" onClick={() => {}}>
                                        Claim
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export default ClaimCarte