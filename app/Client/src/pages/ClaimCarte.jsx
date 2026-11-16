import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import Card from '../components/Card'
import { useAuth } from '../auth/AuthContext'
import { API_BASE_URL } from '../config'
import '../css/ClaimCarte.css'

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
    const [hasClaimedCurrentRound, setHasClaimedCurrentRound] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [error, setError] = useState('')

    // Claim possible seulement si pas de cooldown global et pas encore claim dans le round.
    const canClaimNow = useMemo(() => {
        return Boolean(token) && cooldownRemainingSeconds === 0 && !hasClaimedCurrentRound
    }, [token, cooldownRemainingSeconds, hasClaimedCurrentRound])

    useEffect(() => {
        let cancelled = false

        // Compteur global de connexions pour informer les joueurs en direct.
        const fetchOnlineUsers = async () => {
            try {
                const headers = token ? { Authorization: `Bearer ${token}` } : {}
                const response = await fetch(`${API_BASE_URL}/api/online-users`, { headers })
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
        let socket = null

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
                if (Number.isFinite(statusData.connectedUsers)) {
                    setConnectedUsers(statusData.connectedUsers)
                }
                const alreadyClaimed = Boolean(statusData.hasClaimedCurrentRound)
                setHasClaimedCurrentRound(alreadyClaimed)
                setClaimedCardIds(Array.isArray(statusData.claimedCardIds) ? statusData.claimedCardIds : [])
                setClaimedCount(Number.isFinite(statusData.claimedCount) ? statusData.claimedCount : 0)
                setExpectedClaimCount(Number.isFinite(statusData.expectedClaimCount) ? statusData.expectedClaimCount : 0)

                // Si le round est terminé (cooldown) ou si ce joueur a déjà réclamé, retour direct au dashboard
                if (alreadyClaimed || remaining > 0) {
                    navigate('/', { replace: true })
                    return
                }

                if (remaining > 0) {
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

        // Écouter les mises à jour en temps réel via Socket.IO
        // Quand un autre joueur claim la dernière carte et déclenche le cooldown,
        // on reçoit drop:updated immédiatement sans attendre le poll.
        try {
            socket = io(API_BASE_URL)
            socket.on('drop:updated', () => {
                if (!cancelled) fetchClaimStatus()
            })
        } catch {
            // Si socket.io échoue, on se rabat sur le poll
        }

        const intervalId = window.setInterval(fetchClaimStatus, 1500)

        return () => {
            cancelled = true
            window.clearInterval(intervalId)
            if (socket) socket.disconnect()
        }
    }, [token, navigate])

    useEffect(() => {
        if (hasClaimedCurrentRound || cooldownRemainingSeconds > 0) {
            navigate('/', { replace: true })
        }
    }, [hasClaimedCurrentRound, cooldownRemainingSeconds, navigate])

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
        if (!token || cooldownRemainingSeconds > 0 || selectedCards.length > 0) {
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
    }, [token, cooldownRemainingSeconds, selectedCards.length])

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
                if (data?.hasClaimedCurrentRound !== undefined) {
                    setHasClaimedCurrentRound(data.hasClaimedCurrentRound)
                }
                setFeedback({
                    type: 'error',
                    message: data?.error || 'Impossible de réclamer cette carte',
                })
                return
            }

            setSelectedCards([])
            setHasClaimedCurrentRound(true)
            setCooldownRemainingSeconds(data?.cooldownRemainingSeconds ?? 0)
            setClaimedCardIds(Array.isArray(data?.claimedCardIds) ? data.claimedCardIds : claimedCardIds)
            setClaimedCount(data?.claimedCount ?? claimedCount)
            setExpectedClaimCount(data?.expectedClaimCount ?? expectedClaimCount)
            if (Number.isFinite(data?.connectedUsers)) {
                setConnectedUsers(data.connectedUsers)
            }
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

    const roundProgress = expectedClaimCount > 0
        ? Math.min(100, Math.max(0, (claimedCount / expectedClaimCount) * 100))
        : 0

    return (
        <main className="claim-page">
            <div className="claim-container">
                <header className="claim-hero">
                    <div className="claim-hero-copy">
                        <span className="claim-eyebrow">LE TIRAGE • M9 TCG</span>
                        <h1>Votre prochaine carte<br /><span>vous attend.</span></h1>
                        <p>Un tirage partagé. Trois possibilités. Choisissez la carte qui rejoindra votre collection.</p>
                        <div className="claim-hero-tags">
                            <span>100 % gratuit</span>
                            <span>1 carte par round</span>
                        </div>
                    </div>
                    <div className="claim-hero-art" aria-hidden="true">
                        <div className="claim-art-card claim-art-card--back" />
                        <div className="claim-art-card claim-art-card--front"><span>✦</span><small>M9 TCG</small></div>
                    </div>
                </header>

                <section className="claim-round" aria-label="État du round">
                    <div className="claim-online"><span className="claim-live-dot" aria-hidden="true" /><strong>{connectedUsers}</strong> joueur{connectedUsers > 1 ? 's' : ''} en ligne</div>
                    <div className="claim-progress">
                        <div className="claim-progress-label"><span>Progression du round</span><strong>{claimedCount} / {expectedClaimCount || 0}</strong></div>
                        <div className="claim-progress-track" role="progressbar" aria-label="Progression du round" aria-valuenow={claimedCount} aria-valuemin={0} aria-valuemax={Math.max(expectedClaimCount, claimedCount, 1)}>
                            <span style={{ width: `${roundProgress}%` }} />
                        </div>
                    </div>
                    <span className="claim-round-state">{isCooldownActive ? `Prochain tirage : ${formatTime(cooldownRemainingSeconds)}` : 'Tirage en cours'}</span>
                </section>

                <section className="claim-selection" aria-labelledby="claim-selection-title" aria-busy={loading || isClaiming}>
                    <div className="claim-section-heading">
                        <div><span className="claim-eyebrow">À VOUS DE JOUER</span><h2 id="claim-selection-title">Faites votre choix</h2></div>
                        <p>Une seule carte. À vous de décider.</p>
                    </div>

                    {!token ? (
                        <div className="claim-message"><span className="claim-message-symbol" aria-hidden="true">✦</span><h3>Votre collection commence ici</h3><p>Connectez-vous pour découvrir le tirage et réclamer votre carte gratuite.</p></div>
                    ) : loading ? (
                        <div className="claim-loading" role="status"><span className="claim-spinner" aria-hidden="true" />Préparation de votre tirage…</div>
                    ) : error ? (
                        <div className="claim-message claim-message--error" role="alert"><h3>Le tirage est indisponible</h3><p>{error}</p></div>
                    ) : isCooldownActive ? (
                        <div className="claim-message" role="status"><h3>Le prochain tirage arrive</h3><p>Encore {formatTime(cooldownRemainingSeconds)} avant de nouvelles cartes.</p></div>
                    ) : selectedCards.length === 0 ? (
                        <div className="claim-message"><h3>Le tirage se prépare</h3><p>Aucune carte disponible pour le moment. Revenez bientôt !</p></div>
                    ) : (
                        <div className="claim-cards-grid">
                            {selectedCards.map((carte, index) => {
                                const isCardAlreadyClaimed = claimedCardIds.includes(carte.id_carte)
                                const disabled = isClaiming || !canClaimNow || isCardAlreadyClaimed
                                return (
                                    <article key={carte.id_carte} className={`claim-choice claim-choice--rarity-${carte.rarete}${isCardAlreadyClaimed ? ' is-claimed' : ''}`} style={{ '--claim-delay': `${index * 100}ms` }}>
                                        <div className="claim-choice-top"><span className="claim-rarity"><span aria-hidden="true">✦</span> {rarityMeta[carte.rarete]?.label ?? 'Carte'}</span><span className="claim-chance">{rarityMeta[carte.rarete]?.chance ?? '—'}</span></div>
                                        <div className="claim-card-preview" inert><Card carte={carte} onClick={() => { }} /></div>
                                        <button className="claim-button" type="button" disabled={disabled} onClick={() => handleClaimCard(carte.id_carte)} aria-label={`${isCardAlreadyClaimed ? 'Déjà réclamée' : 'Réclamer'} : ${carte.nom_carte}`}>
                                            {isCardAlreadyClaimed ? 'Déjà réclamée' : isClaiming ? 'Réclamation en cours…' : hasClaimedCurrentRound ? 'Carte déjà obtenue' : 'Réclamer cette carte'}
                                            {!disabled && <span aria-hidden="true">✦</span>}
                                        </button>
                                        <p className="claim-choice-note">{isCardAlreadyClaimed ? 'Un autre joueur a choisi cette carte.' : 'À ajouter à votre collection'}</p>
                                    </article>
                                )
                            })}
                        </div>
                    )}
                    {feedback && <p className={`claim-feedback claim-feedback--${feedback.type}`} role="alert">{feedback.message}</p>}
                </section>

                <footer className="claim-guide"><span aria-hidden="true">✦</span><p><strong>Le principe est simple.</strong> Chaque joueur choisit une carte du tirage commun. Une carte déjà réclamée n’est plus disponible. Une fois le round terminé, le prochain tirage se prépare.</p></footer>
            </div>
        </main>
    )
}

export default ClaimCarte
