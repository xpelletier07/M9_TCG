import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { API_BASE_URL } from '../config'
import Card from '../components/Card'

import '../css/Decks.css'

function Decks() {
    const { user, token } = useAuth()
    const navigate = useNavigate()

    // ── États principaux ──
    const [decks, setDecks] = useState([])
    const [selectedDeckId, setSelectedDeckId] = useState(null)
    const [selectedDeck, setSelectedDeck] = useState(null)
    const [inventory, setInventory] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [successMessage, setSuccessMessage] = useState(null)

    // ── États Modale Sélection de Cartes ("Mini-Page") ──
    const [showCardPicker, setShowCardPicker] = useState(false)
    const [pickerSearch, setPickerSearch] = useState('')
    const [pickerRarity, setPickerRarity] = useState('all')
    const [pickerMana, setPickerMana] = useState('all')

    // ── États Modale Création / Édition de Deck ──
    const [deckModalMode, setDeckModalMode] = useState(null) // 'create' | 'edit' | null
    const [deckFormName, setDeckFormName] = useState('')
    const [deckFormImage, setDeckFormImage] = useState('')
    const [deckFormSubmitting, setDeckFormSubmitting] = useState(false)

    // ── État Modale Confirmation Suppression ──
    const [deckToDelete, setDeckToDelete] = useState(null)
    const [deletingDeck, setDeletingDeck] = useState(false)

    // Flash message timer
    useEffect(() => {
        if (!successMessage) return
        const timer = setTimeout(() => setSuccessMessage(null), 3500)
        return () => clearTimeout(timer)
    }, [successMessage])

    // Fermeture des modales avec Échap
    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                if (showCardPicker) setShowCardPicker(false)
                if (deckModalMode) setDeckModalMode(null)
                if (deckToDelete) setDeckToDelete(null)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [showCardPicker, deckModalMode, deckToDelete])

    // ── Chargement des détails d'un deck ──
    async function loadDeckDetails(deckId) {
        if (!deckId || !token) {
            setSelectedDeck(null)
            return
        }

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/decks/${deckId}`, {
                headers: { Authorization: `Bearer ${token}` },
            })

            if (!response.ok) {
                throw new Error('Impossible de charger le deck sélectionné')
            }

            const data = await response.json()
            // Mise à jour directe du deck sélectionné (corrige le bug de changement de deck)
            setSelectedDeck(data)
        } catch (err) {
            console.error('Erreur loadDeckDetails:', err)
            setError(err.message)
        }
    }

    // ── Chargement initial des decks + inventaire ──
    async function fetchDecksData(preferredDeckId = null, showLoader = false) {
        if (!user || !token) {
            setDecks([])
            setSelectedDeck(null)
            setInventory([])
            return
        }

        if (showLoader) {
            setLoading(true)
        }
        setError(null)

        try {
            const [decksResponse, inventaireResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/inventory/decks`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_BASE_URL}/inventory/cards`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ])

            if (!decksResponse.ok) throw new Error('Erreur lors de la récupération des decks')
            if (!inventaireResponse.ok) throw new Error("Erreur lors de la récupération de l'inventaire")

            const deckList = await decksResponse.json()
            const carteList = await inventaireResponse.json()

            setDecks(deckList)
            setInventory(carteList)

            if (deckList.length === 0) {
                setSelectedDeckId(null)
                setSelectedDeck(null)
                return
            }

            // Conserver le deck préféré s'il existe
            const targetId = preferredDeckId ?? selectedDeckId
            const nextDeckId = targetId && deckList.some((d) => String(d.id_deck) === String(targetId))
                ? targetId
                : deckList[0].id_deck

            setSelectedDeckId(nextDeckId)
            if (showLoader || nextDeckId !== selectedDeckId) {
                await loadDeckDetails(nextDeckId)
            }
        } catch (err) {
            console.error('Erreur fetchDecksData:', err)
            setError(err.message)
        } finally {
            if (showLoader) {
                setLoading(false)
            }
        }
    }

    useEffect(() => {
        fetchDecksData(null, true)
    }, [user, token])

    // ── Sélection d'un deck dans la liste ──
    function handleSelectDeck(deckId) {
        if (!deckId) return
        setSelectedDeckId(deckId)
        loadDeckDetails(deckId)
    }

    // ── Résolution de l'image de couverture d'un deck ──
    // Règle : Si l'utilisateur n'a pas défini d'image, on prend l'image de la carte la plus rare
    function getDeckCoverImage(deck) {
        if (!deck) return null

        // 1. Image personnalisée explicitement définie par l'utilisateur
        if (deck.image && typeof deck.image === 'string' && deck.image.trim()) {
            return deck.image.trim()
        }

        // 2. Si c'est le deck sélectionné actif, on a ses cartes en mémoire
        const cartes = (Number(deck.id_deck) === Number(selectedDeck?.id_deck) ? selectedDeck?.cartes : deck.cartes) || []
        if (cartes.length > 0) {
            // Rareté la plus haute : 4 (Légendaire) > 3 (Épique) > 2 (Rare) > 1 (Commun)
            const cartePlusRare = [...cartes].sort((a, b) => (b.rarete ?? 0) - (a.rarete ?? 0))[0]
            if (cartePlusRare && cartePlusRare.image) {
                return cartePlusRare.image
            }
        }

        // 3. Fallback calculé par l'API dans la liste des decks (`image_carte_rare`)
        if (deck.image_carte_rare && typeof deck.image_carte_rare === 'string' && deck.image_carte_rare.trim()) {
            return deck.image_carte_rare.trim()
        }

        return null
    }

    // ── Ouvrir modale Création de Deck ──
    function openCreateDeckModal() {
        setDeckFormName('')
        setDeckFormImage('') // Pas d'image par défaut obligatoire !
        setDeckModalMode('create')
        setError(null)
    }

    // ── Ouvrir modale Édition de Deck ──
    function openEditDeckModal(deck) {
        setDeckFormName(deck.nom_deck || '')
        setDeckFormImage(deck.image || '')
        setDeckModalMode('edit')
        setError(null)
    }

    // ── Soumission Formulaire Deck (Création ou Édition) ──
    async function handleSaveDeck(event) {
        event.preventDefault()
        setError(null)

        if (!deckFormName.trim()) {
            setError('Le nom du deck est obligatoire.')
            return
        }

        try {
            setDeckFormSubmitting(true)
            const payload = {
                nomDeck: deckFormName.trim(),
                image: deckFormImage.trim(), // Optionnel : chaîne vide acceptée
            }

            if (deckModalMode === 'create') {
                const response = await fetch(`${API_BASE_URL}/inventory/decks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                })

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}))
                    throw new Error(data.error || 'Impossible de créer le deck')
                }

                const newDeck = await response.json()
                setSuccessMessage(`Deck « ${deckFormName} » créé avec succès !`)
                setDeckModalMode(null)
                await fetchDecksData(newDeck.id_deck)
            } else if (deckModalMode === 'edit' && selectedDeckId) {
                const response = await fetch(`${API_BASE_URL}/inventory/decks/${selectedDeckId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                })

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}))
                    throw new Error(data.error || 'Impossible de modifier le deck')
                }

                setSuccessMessage(`Deck mis à jour !`)
                setDeckModalMode(null)
                await fetchDecksData(selectedDeckId)
            }
        } catch (err) {
            console.error('Erreur handleSaveDeck:', err)
            setError(err.message)
        } finally {
            setDeckFormSubmitting(false)
        }
    }

    // ── Suppression d'un deck ──
    async function handleDeleteDeck() {
        if (!deckToDelete) return

        try {
            setDeletingDeck(true)
            const response = await fetch(`${API_BASE_URL}/inventory/decks/${deckToDelete.id_deck}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            })

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}))
                throw new Error(payload.error || 'Impossible de supprimer le deck')
            }

            setSuccessMessage(`Deck « ${deckToDelete.nom_deck} » supprimé.`)
            setDeckToDelete(null)
            await fetchDecksData()
        } catch (err) {
            console.error('Erreur handleDeleteDeck:', err)
            setError(err.message)
        } finally {
            setDeletingDeck(false)
        }
    }

    // ── Ajout d'une carte au deck (+1) ──
    async function handleAddCardToDeck(carte) {
        if (!selectedDeckId) return

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/decks/${selectedDeckId}/cards/${carte.id_carte}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ quantite: 1 }),
            })

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}))
                throw new Error(payload.error || "Impossible d'ajouter la carte au deck")
            }

            await loadDeckDetails(selectedDeckId)
            fetchDecksData(selectedDeckId)
        } catch (err) {
            console.error('Erreur handleAddCardToDeck:', err)
            setError(err.message)
        }
    }

    // ── Retrait de TOUTES les copies d'une carte du deck ──
    async function handleRemoveCardFromDeck(carteId) {
        if (!selectedDeckId) return

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/decks/${selectedDeckId}/cards/${carteId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            })

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}))
                throw new Error(payload.error || 'Impossible de retirer la carte du deck')
            }

            await loadDeckDetails(selectedDeckId)
            fetchDecksData(selectedDeckId)
        } catch (err) {
            console.error('Erreur handleRemoveCardFromDeck:', err)
            setError(err.message)
        }
    }

    // ── Calcul des métriques du deck sélectionné ──
    const selectedDeckCards = selectedDeck?.cartes || []

    const deckMetrics = useMemo(() => {
        let totalCount = 0
        let totalMana = 0
        let totalAttack = 0
        let totalHealth = 0
        const rarityCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }

        for (const carte of selectedDeckCards) {
            const qty = carte.quantite ?? 1
            totalCount += qty
            totalMana += (carte.mana ?? 0) * qty
            totalAttack += (carte.damage ?? 0) * qty
            totalHealth += (carte.health ?? 0) * qty
            if (carte.rarete && rarityCounts[carte.rarete] !== undefined) {
                rarityCounts[carte.rarete] += qty
            }
        }

        const avgMana = totalCount > 0 ? (totalMana / totalCount).toFixed(1) : '0.0'

        return {
            totalCount,
            uniqueCount: selectedDeckCards.length,
            avgMana,
            totalAttack,
            totalHealth,
            rarityCounts,
        }
    }, [selectedDeckCards])

    // Image de couverture résolue pour le deck actif
    const heroCoverUrl = getDeckCoverImage(selectedDeck)

    // ── Quantités disponibles pour la modale Card Picker ──
    const deckCardMap = useMemo(() => {
        const map = {}
        for (const carte of selectedDeckCards) {
            map[carte.id_carte] = (map[carte.id_carte] || 0) + (carte.quantite ?? 0)
        }
        return map
    }, [selectedDeckCards])

    const inventoryWithAvailable = useMemo(() => {
        return inventory.map((carte) => {
            const dansLeDeck = deckCardMap[carte.id_carte] || 0
            const disponible = Math.max(0, (carte.quantite ?? 0) - dansLeDeck)
            return { ...carte, disponible }
        })
    }, [inventory, deckCardMap])

    // Filtrage pour la modale
    const filteredInventory = useMemo(() => {
        return inventoryWithAvailable.filter((carte) => {
            // Filtre nom
            const matchName = (carte?.nom_carte || '').toLowerCase().includes(pickerSearch.toLowerCase())
            if (!matchName) return false

            // Filtre rareté
            if (pickerRarity !== 'all' && String(carte.rarete) !== String(pickerRarity)) {
                return false
            }

            // Filtre mana
            if (pickerMana === '0-2' && (carte.mana < 0 || carte.mana > 2)) return false
            if (pickerMana === '3-4' && (carte.mana < 3 || carte.mana > 4)) return false
            if (pickerMana === '5+' && carte.mana < 5) return false

            return true
        })
    }, [inventoryWithAvailable, pickerSearch, pickerRarity, pickerMana])

    return (
        <main className="content-left-spacing decks-page">
            {/* ── En-tête de la page ── */}
            <div className="decks-header">
                <div>
                    <div className="decks-kicker-row">
                    </div>
                    <h1 className="decks-title">Mes Decks</h1>
                    <p className="decks-subtitle">
                        Concevez votre stratégie, assemblez vos cartes maîtresses et préparez-vous au duel.
                    </p>
                </div>

                <div className="decks-header-actions">
                    <button
                        className="decks-btn decks-btn--secondary"
                        type="button"
                        onClick={() => navigate('/inventaire')}
                    >
                        <i className="fa-solid fa-arrow-left" />
                        <span>Inventaire</span>
                    </button>
                    <button
                        className="decks-btn decks-btn--primary"
                        type="button"
                        onClick={openCreateDeckModal}
                    >
                        <i className="fa-solid fa-plus" />
                        <span>Nouveau deck</span>
                    </button>
                </div>
            </div>

            {/* ── Notifications ── */}
            {error && (
                <div className="decks-alert decks-alert--danger">
                    <i className="fa-solid fa-triangle-exclamation" />
                    <span>{error}</span>
                    <button className="decks-alert-close" type="button" onClick={() => setError(null)}>✕</button>
                </div>
            )}

            {successMessage && (
                <div className="decks-alert decks-alert--success">
                    <i className="fa-solid fa-circle-check" />
                    <span>{successMessage}</span>
                    <button className="decks-alert-close" type="button" onClick={() => setSuccessMessage(null)}>✕</button>
                </div>
            )}

            {/* ── Contenu principal ── */}
            {loading ? (
                <div className="decks-loading">
                    <span className="decks-spinner" />
                    <p>Synchronisation de votre grimoire de decks…</p>
                </div>
            ) : (
                <div className="decks-layout">
                    {/* ── Colonne Gauche : Liste des Decks ── */}
                    <aside className="decks-sidebar">
                        <div className="decks-sidebar-header">
                            <div>
                                <h2 className="decks-sidebar-title">Mes Decks</h2>
                                <span className="decks-sidebar-count">
                                    {decks.length} deck{decks.length > 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>

                        {decks.length === 0 ? (
                            <div className="decks-empty-sidebar">
                                <div className="decks-empty-icon">
                                    <i className="fa-solid fa-layer-group" />
                                </div>
                                <p className="decks-empty-title">Aucun deck créé</p>
                                <p className="decks-empty-text">Créez votre tout premier deck pour entrer dans l&apos;arène.</p>
                                <button
                                    className="decks-btn decks-btn--primary decks-btn--sm mt-3"
                                    type="button"
                                    onClick={openCreateDeckModal}
                                >
                                    + Créer un deck
                                </button>
                            </div>
                        ) : (
                            <ul className="decks-list">
                                {decks.map((deck) => {
                                    const isSelected = String(selectedDeckId) === String(deck.id_deck)
                                    const coverUrl = getDeckCoverImage(deck)
                                    return (
                                        <li key={deck.id_deck} className="decks-list-item-wrap">
                                            <button
                                                type="button"
                                                className={`decks-list-item ${isSelected ? 'decks-list-item--active' : ''}`}
                                                onClick={() => handleSelectDeck(deck.id_deck)}
                                            >
                                                <div className="decks-list-thumb-wrapper">
                                                    {coverUrl ? (
                                                        <img className="decks-list-thumb" src={coverUrl} alt="" />
                                                    ) : (
                                                        <div className="decks-list-thumb-fallback">
                                                            <i className="fa-solid fa-shield-halved" />
                                                        </div>
                                                    )}
                                                    {isSelected && <span className="decks-list-active-indicator" />}
                                                </div>

                                                <div className="decks-list-info">
                                                    <span className="decks-list-name" title={deck.nom_deck}>
                                                        {deck.nom_deck}
                                                    </span>
                                                    <span className="decks-list-meta">
                                                        {deck.total_cartes ?? 0} carte{(deck.total_cartes ?? 0) > 1 ? 's' : ''}
                                                    </span>
                                                </div>

                                                <span className="decks-list-count-badge">
                                                    {deck.total_cartes ?? 0}
                                                </span>
                                            </button>

                                            {/* Actions rapides du deck */}
                                            <div className="decks-item-actions">
                                                <button
                                                    type="button"
                                                    className="decks-item-action-btn"
                                                    title="Modifier le deck"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        openEditDeckModal(deck)
                                                    }}
                                                >
                                                    <i className="fa-solid fa-pen" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="decks-item-action-btn decks-item-action-btn--danger"
                                                    title="Supprimer le deck"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setDeckToDelete(deck)
                                                    }}
                                                >
                                                    <i className="fa-solid fa-trash-can" />
                                                </button>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </aside>

                    {/* ── Colonne Droite : Deck Actif ── */}
                    <section className="decks-main">
                        {selectedDeck ? (
                            <div className="decks-showcase">
                                {/* ── Hero Deck Banner ── */}
                                <div className="decks-hero-banner">
                                    {heroCoverUrl && (
                                        <div
                                            className="decks-hero-bg"
                                            style={{ backgroundImage: `url(${heroCoverUrl})` }}
                                        />
                                    )}
                                    <div className="decks-hero-content">
                                        <div className="decks-hero-avatar-wrap">
                                            {heroCoverUrl ? (
                                                <img src={heroCoverUrl} alt={selectedDeck.nom_deck} />
                                            ) : (
                                                <div className="decks-hero-avatar-fallback">
                                                    <i className="fa-solid fa-shield-halved" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="decks-hero-meta">
                                            <div className="decks-hero-tag">
                                                <i className="fa-solid fa-star" /> Deck Actif
                                            </div>
                                            <h2 className="decks-hero-title">{selectedDeck.nom_deck}</h2>
                                            <p className="decks-hero-created">
                                                Créé le {selectedDeck.cree_le ? new Date(selectedDeck.cree_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                                            </p>
                                        </div>

                                        <div className="decks-hero-actions">
                                            <button
                                                className="decks-btn decks-btn--glow"
                                                type="button"
                                                onClick={() => setShowCardPicker(true)}
                                            >
                                                <i className="fa-solid fa-plus-circle" />
                                                <span>Ajouter des cartes</span>
                                            </button>
                                            <button
                                                className="decks-btn decks-btn--ghost"
                                                type="button"
                                                title="Modifier le nom ou l'image"
                                                onClick={() => openEditDeckModal(selectedDeck)}
                                            >
                                                <i className="fa-solid fa-pen" />
                                                <span>Modifier</span>
                                            </button>
                                            <button
                                                className="decks-btn decks-btn--danger-ghost"
                                                type="button"
                                                title="Supprimer ce deck"
                                                onClick={() => setDeckToDelete(selectedDeck)}
                                            >
                                                <i className="fa-solid fa-trash-can" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Barre de Statistiques & Analytics du Deck ── */}
                                <div className="decks-hud-bar">
                                    <div className="decks-hud-stat">
                                        <span className="decks-hud-label">Total Cartes</span>
                                        <span className="decks-hud-value">
                                            <strong>{deckMetrics.totalCount}</strong>
                                            <span className="decks-hud-sub">({deckMetrics.uniqueCount} uniques)</span>
                                        </span>
                                    </div>

                                    <div className="decks-hud-stat">
                                        <span className="decks-hud-label">Mana Moyen</span>
                                        <span className="decks-hud-value decks-hud-value--mana">
                                            <i className="fa-solid fa-bolt" /> {deckMetrics.avgMana}
                                        </span>
                                    </div>

                                    <div className="decks-hud-stat">
                                        <span className="decks-hud-label">Puissance ATQ / VIE</span>
                                        <span className="decks-hud-value decks-hud-value--power">
                                            <span className="stat-atq"><i className="fa-solid fa-khanda" /> {deckMetrics.totalAttack}</span>
                                            <span className="stat-sep">•</span>
                                            <span className="stat-vie"><i className="fa-solid fa-heart" /> {deckMetrics.totalHealth}</span>
                                        </span>
                                    </div>

                                    <div className="decks-hud-stat decks-hud-stat--rarities">
                                        <span className="decks-hud-label">Distribution des raretés</span>
                                        <div className="decks-rarity-pills">
                                            <span className="rarity-pill rarity-pill--1" title="Commune">C {deckMetrics.rarityCounts[1]}</span>
                                            <span className="rarity-pill rarity-pill--2" title="Rare">R {deckMetrics.rarityCounts[2]}</span>
                                            <span className="rarity-pill rarity-pill--3" title="Épique">E {deckMetrics.rarityCounts[3]}</span>
                                            <span className="rarity-pill rarity-pill--4" title="Légendaire">L {deckMetrics.rarityCounts[4]}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Grille de Cartes dans le Deck ── */}
                                <div className="decks-cards-section">
                                    <div className="decks-cards-header">
                                        <h3 className="decks-cards-title">
                                            Composition du Deck
                                            <span className="decks-cards-badge">{selectedDeckCards.length}</span>
                                        </h3>
                                    </div>

                                    {selectedDeckCards.length === 0 ? (
                                        <div className="decks-empty-deck-state">
                                            <div className="decks-empty-deck-illustration">
                                                <i className="fa-solid fa-hat-wizard" />
                                            </div>
                                            <h4>Ce deck est encore vide !</h4>
                                            <p>
                                                Ouvrez votre inventaire pour choisir les cartes qui composeront votre stratégie.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="decks-cards-grid inventory-cards-grid">
                                            {selectedDeckCards.map((carte) => (
                                                <div
                                                    className="decks-card-wrapper"
                                                    key={`${selectedDeck.id_deck}-${carte.id_carte}`}
                                                >
                                                    <Card
                                                        carte={carte}
                                                        quantite={carte.quantite ?? 1}
                                                        onClick={() => { }}
                                                    />
                                                    <button
                                                        className="decks-remove-badge"
                                                        type="button"
                                                        title={carte.quantite > 1 ? `Retirer 1 exemplaire (reste ${carte.quantite - 1})` : "Retirer la carte du deck"}
                                                        onClick={() => handleRemoveCardFromDeck(carte.id_carte)}
                                                    >
                                                        <i className="fa-solid fa-minus" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="decks-empty-state decks-empty-state--full">
                                <div className="decks-empty-deck-illustration">
                                    <i className="fa-solid fa-cards-blank" />
                                </div>
                                <h3>Aucun deck sélectionné</h3>
                                <p>Choisissez un deck dans la liste de gauche ou créez-en un nouveau pour commencer.</p>
                                <button
                                    className="decks-btn decks-btn--primary mt-3"
                                    type="button"
                                    onClick={openCreateDeckModal}
                                >
                                    + Créer un nouveau deck
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
               MINI-PAGE / MODALE DE SÉLECTION DE CARTES ("CARD PICKER")
               ══════════════════════════════════════════════════════════════ */}
            {showCardPicker && selectedDeck && (
                <div
                    className="decks-modal-backdrop"
                    onClick={() => setShowCardPicker(false)}
                    role="presentation"
                >
                    <div
                        className="decks-modal-window"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="decks-modal-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ── En-tête HUD ── */}
                        <div className="decks-modal-header">
                            <div className="decks-modal-header-text">
                                <div className="decks-modal-kicker-row">
                                    <span className="decks-modal-kicker">Grimoire d&apos;Inventaire</span>
                                    <span className="decks-modal-deck-pill">
                                        <i className="fa-solid fa-shield-halved" /> {selectedDeck.nom_deck} ({deckMetrics.totalCount} cartes)
                                    </span>
                                </div>
                                <h2 id="decks-modal-title" className="decks-modal-title">
                                    Sélectionnez les cartes à ajouter
                                </h2>
                                <p className="decks-modal-subtitle">
                                    Cliquez sur une carte pour l&apos;intégrer à votre deck.
                                </p>
                            </div>

                            <button
                                className="decks-modal-close-btn"
                                type="button"
                                aria-label="Fermer la fenêtre"
                                title="Fermer (Échap)"
                                onClick={() => setShowCardPicker(false)}
                            >
                                ✕
                            </button>
                        </div>

                        {/* ── Barre de Filtres & Recherche ── */}
                        <div className="decks-modal-filterbar">
                            <div className="decks-search-wrap">
                                <i className="fa-solid fa-magnifying-glass decks-search-icon" />
                                <input
                                    className="decks-picker-search"
                                    type="text"
                                    placeholder="Rechercher par nom de carte…"
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    autoFocus
                                />
                                {pickerSearch && (
                                    <button
                                        type="button"
                                        className="decks-search-clear"
                                        onClick={() => setPickerSearch('')}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Filtres Rareté */}
                            <div className="decks-filter-group">
                                <span className="decks-filter-label">Rareté :</span>
                                <div className="decks-filter-pills">
                                    {[
                                        { id: 'all', label: 'Toutes' },
                                        { id: '1', label: 'Commune' },
                                        { id: '2', label: 'Rare' },
                                        { id: '3', label: 'Épique' },
                                        { id: '4', label: 'Légendaire' },
                                    ].map((r) => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            className={`decks-filter-pill ${pickerRarity === r.id ? 'decks-filter-pill--active' : ''}`}
                                            onClick={() => setPickerRarity(r.id)}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Filtres Mana */}
                            <div className="decks-filter-group">
                                <span className="decks-filter-label">Mana :</span>
                                <div className="decks-filter-pills">
                                    {[
                                        { id: 'all', label: 'Tous' },
                                        { id: '0-2', label: '0-2' },
                                        { id: '3-4', label: '3-4' },
                                        { id: '5+', label: '5+' },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            className={`decks-filter-pill ${pickerMana === m.id ? 'decks-filter-pill--active' : ''}`}
                                            onClick={() => setPickerMana(m.id)}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Grille Défilante ── */}
                        <div className="decks-modal-body">
                            {filteredInventory.length === 0 ? (
                                <div className="decks-modal-empty">
                                    <div className="decks-modal-empty-icon">
                                        <i className="fa-solid fa-ghost" />
                                    </div>
                                    <p className="decks-modal-empty-title">Aucune carte trouvée</p>
                                    <p className="decks-modal-empty-sub">
                                        Modifiez vos filtres ou effectuez une recherche différente.
                                    </p>
                                </div>
                            ) : (
                                <div className="decks-picker-grid inventory-cards-grid">
                                    {filteredInventory.map((carte) => {
                                        const isMaxed = carte.disponible <= 0
                                        return (
                                            <div
                                                className={`decks-picker-card-wrapper ${isMaxed ? 'decks-picker-card-wrapper--disabled' : ''}`}
                                                key={carte.id_carte}
                                                onClick={() => {
                                                    if (!isMaxed) handleAddCardToDeck(carte)
                                                }}
                                                title={isMaxed ? 'Toutes les copies de cette carte sont déjà dans le deck' : 'Cliquer pour ajouter +1 au deck'}
                                            >
                                                <Card
                                                    carte={carte}
                                                    quantite={carte.disponible}
                                                />
                                                {isMaxed && (
                                                    <div className="decks-picker-unavailable">
                                                        <i className="fa-solid fa-lock" />
                                                        <span>Complet dans le deck</span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── Pied de la Mini-Page ── */}
                        <div className="decks-modal-footer">
                            <div className="decks-modal-footer-stats">
                                <span className="decks-stat-pill">
                                    <i className="fa-solid fa-layer-group" />
                                    <strong>{filteredInventory.length}</strong> cartes uniques affichées
                                </span>
                            </div>

                            <button
                                className="decks-btn decks-btn--primary decks-btn--lg"
                                type="button"
                                onClick={() => setShowCardPicker(false)}
                            >
                                <i className="fa-solid fa-check" />
                                <span>Terminer la sélection</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
               MODALE CRÉATION & ÉDITION DE DECK
               ══════════════════════════════════════════════════════════════ */}
            {deckModalMode && (
                <div
                    className="decks-modal-backdrop"
                    onClick={() => !deckFormSubmitting && setDeckModalMode(null)}
                    role="presentation"
                >
                    <div
                        className="decks-modal-window decks-modal-window--compact"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="decks-modal-header">
                            <div>
                                <span className="decks-modal-kicker">
                                    {deckModalMode === 'create' ? 'Nouveau Deck' : 'Configuration'}
                                </span>
                                <h3 className="decks-modal-title">
                                    {deckModalMode === 'create' ? 'Créer un nouveau deck' : `Modifier « ${deckFormName || 'Deck'} »`}
                                </h3>
                            </div>
                            <button
                                className="decks-modal-close-btn"
                                type="button"
                                disabled={deckFormSubmitting}
                                onClick={() => setDeckModalMode(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveDeck} className="decks-dialog-form">
                            <div className="decks-dialog-body">
                                {/* Nom du deck */}
                                <div className="decks-form-group">
                                    <label className="decks-form-label" htmlFor="deck-name-input">
                                        Nom du deck <span className="decks-required">*</span>
                                    </label>
                                    <input
                                        id="deck-name-input"
                                        className="decks-input"
                                        type="text"
                                        maxLength={30}
                                        placeholder="Ex: Tempête Élémentaire, Gardiens du Néant…"
                                        value={deckFormName}
                                        onChange={(e) => setDeckFormName(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                    <span className="decks-char-counter">{deckFormName.length} / 30</span>
                                </div>

                                {/* URL de l'image de couverture (OPTIONNEL) */}
                                <div className="decks-form-group">
                                    <div className="decks-form-label-row">
                                        <label className="decks-form-label" htmlFor="deck-image-input">
                                            Image de couverture
                                        </label>
                                        <span className="decks-optional-badge">Optionnel</span>
                                    </div>
                                    <input
                                        id="deck-image-input"
                                        className="decks-input"
                                        type="url"
                                        placeholder="https://... (ou laissez vide)"
                                        value={deckFormImage}
                                        onChange={(e) => setDeckFormImage(e.target.value)}
                                    />
                                </div>

                                {/* Aperçu du deck */}
                                <div className="decks-preview-box">
                                    <span className="decks-form-label">Aperçu :</span>
                                    <div className="decks-preview-card">
                                        {deckFormImage ? (
                                            <img
                                                src={deckFormImage}
                                                alt="Aperçu"
                                                onError={(e) => { e.target.style.display = 'none' }}
                                            />
                                        ) : (
                                            <div className="decks-preview-fallback-icon">
                                                <i className="fa-solid fa-wand-magic-sparkles" />
                                            </div>
                                        )}
                                        <div className="decks-preview-text">
                                            <strong>{deckFormName || 'Nom de votre deck'}</strong>
                                            <span>
                                                {deckFormImage
                                                    ? 'Image personnalisée'
                                                    : 'Illustration automatique (carte la plus rare)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="decks-modal-footer">
                                <button
                                    className="decks-btn decks-btn--secondary"
                                    type="button"
                                    disabled={deckFormSubmitting}
                                    onClick={() => setDeckModalMode(null)}
                                >
                                    Annuler
                                </button>
                                <button
                                    className="decks-btn decks-btn--primary"
                                    type="submit"
                                    disabled={deckFormSubmitting}
                                >
                                    {deckFormSubmitting ? (
                                        <>
                                            <span className="decks-spinner decks-spinner--sm" />
                                            <span>Enregistrement…</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-check" />
                                            <span>{deckModalMode === 'create' ? 'Créer le deck' : 'Enregistrer'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
               MODALE CONFIRMATION SUPPRESSION DECK
               ══════════════════════════════════════════════════════════════ */}
            {deckToDelete && (
                <div
                    className="decks-modal-backdrop"
                    onClick={() => !deletingDeck && setDeckToDelete(null)}
                    role="presentation"
                >
                    <div
                        className="decks-modal-window decks-modal-window--alert"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="decks-modal-alert-icon">
                            <i className="fa-solid fa-triangle-exclamation" />
                        </div>
                        <h3 className="decks-modal-title has-text-centered">Supprimer ce deck ?</h3>
                        <p className="decks-modal-alert-text">
                            Êtes-vous certain de vouloir supprimer le deck <strong>« {deckToDelete.nom_deck} »</strong> ?
                            <br />
                            Les cartes contenues retourneront simplement dans votre inventaire.
                        </p>

                        <div className="decks-modal-footer decks-modal-footer--centered">
                            <button
                                className="decks-btn decks-btn--secondary"
                                type="button"
                                disabled={deletingDeck}
                                onClick={() => setDeckToDelete(null)}
                            >
                                Annuler
                            </button>
                            <button
                                className="decks-btn decks-btn--danger"
                                type="button"
                                disabled={deletingDeck}
                                onClick={handleDeleteDeck}
                            >
                                {deletingDeck ? 'Suppression…' : 'Confirmer la suppression'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Decks
