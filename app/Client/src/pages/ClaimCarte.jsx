import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function formatTime(totalSeconds) {
    const safeSeconds = Math.max(0, totalSeconds)
    const minutes = Math.floor(safeSeconds / 60)
    const seconds = safeSeconds % 60

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function ClaimCarte() {
    const navigate = useNavigate()
    const { token } = useAuth()
    const [selectedCards, setSelectedCards] = useState([])
    const [loading, setLoading] = useState(true)
    const [isClaiming, setIsClaiming] = useState(false)
    const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0)
    const [connectedUsers, setConnectedUsers] = useState(0)
    const [claimedCardIds, setClaimedCardIds] = useState([])
    const [claimedCount, setClaimedCount] = useState(0)
    const [expectedClaimCount, setExpectedClaimCount] = useState(0)
    const [feedback, setFeedback] = useState(null)
    const [error, setError] = useState('')

    // Claim possible seulement si pas de cooldown global et pas encore claim dans le round.
    const canClaimNow = useMemo(() => {
        return Boolean(token) && cooldownRemainingSeconds === 0
    }, [token, cooldownRemainingSeconds])

    useEffect(() => {
        let cancelled = false

        // Compteur global de connexions pour informer les joueurs en direct.
        const fetchOnlineUsers = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/online-users`)
                if (!response.ok) {
                    return
                }

                const data = await response.json()
                if (!cancelled) {
                    setConnectedUsers(Number.isFinite(data.connectedUsers) ? data.connectedUsers : 0)
                }
            } catch {
                if (!cancelled) {
                    setConnectedUsers(0)
                }
            }
        }

        fetchOnlineUsers()
        const intervalId = window.setInterval(fetchOnlineUsers, 5000)

        return () => {
            cancelled = true
            window.clearInterval(intervalId)
        }
    }, [])

    useEffect(() => {
        if (!token) {
            setSelectedCards([])
            setLoading(false)
            setError('')
            setFeedback(null)
            setCooldownRemainingSeconds(0)
            setClaimedCardIds([])
            setClaimedCount(0)
            setExpectedClaimCount(0)
            return
        }

        let cancelled = false

        // Synchronise l'etat global du round: cooldown, progression, cartes deja prises.
        async function fetchClaimStatus() {
            try {
                setError('')

                const statusResponse = await fetch(`${API_BASE_URL}/cards/claim/status`, {
                    headers: { Authorization: `Bearer ${token}` },
                })

                if (!statusResponse.ok) {
                    const errorText = await statusResponse.text()
                    throw new Error(errorText || 'Impossible de charger le statut de claim')
                }

                const statusData = await statusResponse.json()

                if (cancelled) {
                    return
                }

                const remaining = statusData.cooldownRemainingSeconds ?? 0
                setCooldownRemainingSeconds(remaining)
                setClaimedCardIds(Array.isArray(statusData.claimedCardIds) ? statusData.claimedCardIds : [])
                setClaimedCount(Number.isFinite(statusData.claimedCount) ? statusData.claimedCount : 0)
                setExpectedClaimCount(Number.isFinite(statusData.expectedClaimCount) ? statusData.expectedClaimCount : 0)

                if (!statusData.canClaim) {
                    setSelectedCards([])
                }
            } catch (fetchError) {
                if (cancelled) {
                    return
                }

                setError(fetchError.message)
                setSelectedCards([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchClaimStatus()
        const intervalId = window.setInterval(fetchClaimStatus, 5000)

        return () => {
            cancelled = true
            window.clearInterval(intervalId)
        }
    }, [token])

    useEffect(() => {
        if (!token || cooldownRemainingSeconds <= 0) {
            return
        }

        const intervalId = window.setInterval(() => {
            setCooldownRemainingSeconds((previous) => Math.max(0, previous - 1))
        }, 1000)

        return () => {
            window.clearInterval(intervalId)
        }
    }, [token, cooldownRemainingSeconds])

    useEffect(() => {
        if (!canClaimNow || selectedCards.length > 0) {
            return
        }

        let cancelled = false

        // Recupere le meme trio de cartes partage par tous les joueurs du round.
        async function fetchCards() {
            try {
                setLoading(true)
                setError('')

                const response = await fetch(`${API_BASE_URL}/cards/claim/options`, {
                    headers: { Authorization: `Bearer ${token}` },
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(errorText || 'Impossible de charger les cartes')
                }

                const data = await response.json()

                if (cancelled) {
                    return
                }

                setSelectedCards(Array.isArray(data?.cards) ? data.cards : [])
                setClaimedCardIds(Array.isArray(data?.claimedCardIds) ? data.claimedCardIds : [])
            } catch (fetchError) {
                if (cancelled) {
                    return
                }

                setError(fetchError.message)
                setSelectedCards([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchCards()

        return () => {
            cancelled = true
        }
    }, [token, canClaimNow, selectedCards.length])

    const handleClaimCard = async (idCarte) => {
        if (!token || isClaiming || !canClaimNow) {
            return
        }

        try {
            setIsClaiming(true)
            setError('')
            setFeedback(null)

            const response = await fetch(`${API_BASE_URL}/cards/claim`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ id_carte: idCarte }),
            })

            const data = await response.json().catch(() => null)

            if (!response.ok) {
                if (data?.cooldownRemainingSeconds !== undefined) {
                    setCooldownRemainingSeconds(data.cooldownRemainingSeconds)
                }
                if (data?.claimedCardIds !== undefined) {
                    setClaimedCardIds(Array.isArray(data.claimedCardIds) ? data.claimedCardIds : [])
                }
                if (data?.claimedCount !== undefined) {
                    setClaimedCount(data.claimedCount)
                }
                if (data?.expectedClaimCount !== undefined) {
                    setExpectedClaimCount(data.expectedClaimCount)
                }
                setFeedback({
                    type: 'error',
                    message: data?.error || 'Impossible de réclamer cette carte',
                })
                return
            }

            setSelectedCards([])
            setCooldownRemainingSeconds(data?.cooldownRemainingSeconds ?? 0)
            setClaimedCardIds(Array.isArray(data?.claimedCardIds) ? data.claimedCardIds : claimedCardIds)
            setClaimedCount(data?.claimedCount ?? claimedCount)
            setExpectedClaimCount(data?.expectedClaimCount ?? expectedClaimCount)
            // Retour dashboard juste apres le claim reussi.
            navigate('/', { replace: true })
        } catch {
            setFeedback({
                type: 'error',
                message: 'Erreur réseau pendant le claim de la carte.',
            })
        } finally {
            setIsClaiming(false)
        }
    }

    const isCooldownActive = cooldownRemainingSeconds > 0

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ marginBottom: '0.5rem' }}>Claim Your Cards</h1>
                <p style={{ margin: 0 }}>
                    Veillez sélectionner les cartes que vous souhaitez réclamer. Vous pouvez choisir une carte parmi
                    3 cartes proposées.
                </p>
                <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                    Joueurs connectés: {connectedUsers}
                </p>
                <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                    Progression du round: {claimedCount}/{expectedClaimCount || 0} joueurs ont claim
                </p>
                {isCooldownActive && (
                    <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                        Prochain claim disponible dans {formatTime(cooldownRemainingSeconds)}
                    </p>
                )}
            </div>

            {!token ? (
                <p>Veuillez vous connecter pour réclamer une carte.</p>
            ) : null}

            {loading ? (
                <p>Loading...</p>
            ) : error ? (
                <p>{error}</p>
            ) : token && isCooldownActive ? (
                <p>Le cooldown de 5 minutes est en cours.</p>
            ) : token && selectedCards.length === 0 ? (
                <p>Aucune carte disponible pour le moment.</p>
            ) : (
                <>
                    <div className="inventory-cards-grid">
                        {selectedCards.map((carte, index) => (
                            (() => {
                                // Carte deja prise dans le round: bouton bloque pour eviter un double-claim.
                                const isCardAlreadyClaimed = claimedCardIds.includes(carte.id_carte)

                                return (
                            <div
                                key={carte.id_carte}
                                style={{ animation: `claim-card-enter 420ms ease ${index * 120}ms both` }}
                            >
                                <div style={{ marginBottom: '0.75rem', fontWeight: 700 }}>
                                    {rarityMeta[carte.rarete]?.label ?? 'Carte'} - {rarityMeta[carte.rarete]?.chance ?? '0%'}
                                </div>
                                <Card carte={carte} onClick={() => {}} />
                                {isCardAlreadyClaimed && (
                                    <p style={{ marginTop: '0.5rem', marginBottom: '0.25rem', fontWeight: 700, color: '#c0382b' }}>
                                        Cette carte est deja claim
                                    </p>
                                )}
                                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        type="button"
                                        disabled={isClaiming || !canClaimNow || isCardAlreadyClaimed}
                                        onClick={() => handleClaimCard(carte.id_carte)}
                                    >
                                        {isClaiming ? 'Claim en cours...' : isCardAlreadyClaimed ? 'Deja claim' : 'Claim'}
                                    </button>
                                </div>
                            </div>
                                )
                            })()
                        ))}
                    </div>
                </>
            )}

            {feedback && (
                <p
                    style={{
                        marginTop: '1rem',
                        fontWeight: 600,
                        color: feedback.type === 'success' ? '#118a4e' : '#c0382b',
                    }}
                >
                    {feedback.message}
                </p>
            )}
        </div>
    )
}

export default ClaimCarte