import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { API_BASE_URL } from '../config'

import 'bulma/css/bulma.min.css'

function Decks() {
    const { user, token } = useAuth()
    const navigate = useNavigate()
    const [decks, setDecks] = useState([])
    const [selectedDeckId, setSelectedDeckId] = useState(null)
    const [selectedDeck, setSelectedDeck] = useState(null)
    const [inventory, setInventory] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [newDeckName, setNewDeckName] = useState('')
    const [newDeckImage, setNewDeckImage] = useState('')
    const [creatingDeck, setCreatingDeck] = useState(false)

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
            setSelectedDeck(data)
        } catch (err) {
            console.error('Erreur loadDeckDetails:', err)
            setError(err.message)
        }
    }

    async function fetchDecksData() {
        if (!user || !token) {
            setDecks([])
            setSelectedDeck(null)
            setInventory([])
            return
        }

        setLoading(true)
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

            if (!decksResponse.ok) {
                throw new Error('Erreur lors de la récupération des decks')
            }

            if (!inventaireResponse.ok) {
                throw new Error('Erreur lors de la récupération de l\'inventaire')
            }

            const deckList = await decksResponse.json()
            const carteList = await inventaireResponse.json()

            setDecks(deckList)
            setInventory(carteList)

            if (deckList.length === 0) {
                setSelectedDeckId(null)
                setSelectedDeck(null)
                return
            }

            const nextDeckId = selectedDeckId && deckList.some((deck) => String(deck.id_deck) === String(selectedDeckId))
                ? selectedDeckId
                : deckList[0].id_deck

            setSelectedDeckId(nextDeckId)
            await loadDeckDetails(nextDeckId)
        } catch (err) {
            console.error('Erreur fetchDecksData:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDecksData()
    }, [user, token])

    async function handleCreateDeck(event) {
        event.preventDefault()
        setError(null)

        if (!newDeckName.trim()) {
            setError('Le nom du deck est obligatoire.')
            return
        }

        if (!newDeckImage.trim()) {
            setError('L\'image du deck est obligatoire.')
            return
        }

        try {
            setCreatingDeck(true)
            const response = await fetch(`${API_BASE_URL}/inventory/decks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ nomDeck: newDeckName.trim(), image: newDeckImage.trim() }),
            })

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}))
                throw new Error(payload.error || 'Impossible de créer le deck')
            }

            setNewDeckName('')
            setNewDeckImage('')
            await fetchDecksData()
        } catch (err) {
            console.error('Erreur handleCreateDeck:', err)
            setError(err.message)
        } finally {
            setCreatingDeck(false)
        }
    }

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
                throw new Error(payload.error || 'Impossible d\'ajouter la carte au deck')
            }

            await fetchDecksData()
        } catch (err) {
            console.error('Erreur handleAddCardToDeck:', err)
            setError(err.message)
        }
    }

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

            await fetchDecksData()
        } catch (err) {
            console.error('Erreur handleRemoveCardFromDeck:', err)
            setError(err.message)
        }
    }

    const selectedDeckCards = selectedDeck?.cartes || []

    return (
        <main className="content-left-spacing decks-page">
            <div className="inventory-header decks-header">
                <div>
                    <h1 className="inventory-title decks-title">Mes decks</h1>
                    <p className="inventory-subtitle decks-subtitle">Créez, sélectionnez et gérez vos decks de cartes.</p>
                </div>
                <div className="buttons">
                    <button className="button is-link decks-back-button" type="button" onClick={() => navigate('/inventaire')}>
                        Retour à l&apos;inventaire
                    </button>
                </div>
            </div>

            {error && (
                <div className="notification is-danger is-light decks-alert">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="box has-text-centered decks-loading">
                    <span className="icon is-medium">
                        <i className="fas fa-spinner fa-spin" />
                    </span>
                    <p>Chargement des decks...</p>
                </div>
            ) : (
                <div className="columns is-variable is-5 decks-layout">
                    <div className="column is-4">
                        <div className="box decks-panel decks-panel-left">
                            <h2 className="title is-5">Liste des decks</h2>

                            <form onSubmit={handleCreateDeck} className="decks-create-form mb-4">
                                <div className="control is-expanded decks-form-control">
                                    <input
                                        className="input decks-input"
                                        type="text"
                                        placeholder="Nom du deck"
                                        value={newDeckName}
                                        onChange={(event) => setNewDeckName(event.target.value)}
                                    />
                                </div>
                                <div className="control is-expanded decks-form-control">
                                    <input
                                        className="input decks-input"
                                        type="url"
                                        placeholder="URL de l'image du deck"
                                        value={newDeckImage}
                                        onChange={(event) => setNewDeckImage(event.target.value)}
                                    />
                                </div>
                                <div className="control decks-form-submit">
                                    <button className="button is-primary decks-create-button" type="submit" disabled={creatingDeck}>
                                        {creatingDeck ? '...' : 'Créer'}
                                    </button>
                                </div>
                            </form>

                            {decks.length === 0 ? (
                                <p className="has-text-grey">Aucun deck pour le moment.</p>
                            ) : (
                                <div className="menu decks-list">
                                    {decks.map((deck) => (
                                        <button
                                            key={deck.id_deck}
                                            type="button"
                                            className={`button is-fullwidth mb-2 deck-list-item ${selectedDeckId === deck.id_deck ? 'deck-list-item-active' : ''}`}
                                            onClick={() => {
                                                setSelectedDeckId(deck.id_deck)
                                                loadDeckDetails(deck.id_deck)
                                            }}
                                        >
                                            <span className="deck-list-name">{deck.nom_deck}</span>
                                            <span className="ml-2 tag is-light deck-list-count">{deck.total_cartes ?? 0}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="column is-8">
                        {selectedDeck ? (
                            <div className="box decks-panel decks-panel-right">
                                <div className="level decks-selected-header">
                                    <div className="level-left decks-selected-meta">
                                        <p className="subtitle is-6 mb-1">Deck sélectionné</p>
                                        <h2 className="title is-4 mb-0">{selectedDeck.nom_deck}</h2>
                                    </div>
                                    <div className="level-right">
                                        <span className="tag is-info is-medium">{selectedDeckCards.length} cartes</span>
                                    </div>
                                </div>

                                {selectedDeck.image && (
                                    <figure className="decks-selected-image">
                                        <img src={selectedDeck.image} alt={selectedDeck.nom_deck} />
                                    </figure>
                                )}

                                {selectedDeckCards.length === 0 ? (
                                    <div className="notification is-light">
                                        Ce deck est vide. Ajoutez des cartes depuis votre inventaire.
                                    </div>
                                ) : (
                                    <div className="columns is-multiline decks-cards-grid">
                                        {selectedDeckCards.map((carte) => (
                                            <div className="column is-6-tablet is-4-desktop" key={`${selectedDeck.id_deck}-${carte.id_carte}`}>
                                                <div className="card decks-card-item">
                                                    <div className="card-image">
                                                        <figure className="image is-4by5">
                                                            <img src={carte.image} alt={carte.nom_carte} style={{ objectFit: 'cover' }} />
                                                        </figure>
                                                    </div>
                                                    <div className="card-content">
                                                        <p className="title is-6 mb-1">{carte.nom_carte}</p>
                                                        <p className="subtitle is-7 has-text-grey mb-2">Quantité : {carte.quantite ?? 1}</p>
                                                        <button
                                                            type="button"
                                                            className="button is-small is-danger is-light"
                                                            onClick={() => handleRemoveCardFromDeck(carte.id_carte)}
                                                        >
                                                            Retirer
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="box has-text-centered decks-empty-state">
                                <p className="has-text-grey">Sélectionnez ou créez un deck pour commencer.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!loading && user && inventory.length > 0 && (
                <section className="box mt-5 decks-panel decks-inventory-panel">
                    <h3 className="title is-5">Ajouter une carte depuis l&apos;inventaire</h3>
                    <div className="columns is-multiline decks-cards-grid">
                        {inventory.map((carte) => (
                            <div className="column is-6-tablet is-4-desktop is-3-widescreen" key={carte.id_carte}>
                                <div className="card decks-card-item">
                                    <div className="card-image">
                                        <figure className="image is-4by5">
                                            <img src={carte.image} alt={carte.nom_carte} style={{ objectFit: 'cover' }} />
                                        </figure>
                                    </div>
                                    <div className="card-content">
                                        <p className="title is-6 mb-1">{carte.nom_carte}</p>
                                        <p className="subtitle is-7 has-text-grey mb-2">Quantité : {carte.quantite ?? 1}</p>
                                        <button
                                            type="button"
                                            className="button is-small is-success is-light"
                                            onClick={() => handleAddCardToDeck(carte)}
                                            disabled={!selectedDeckId}
                                        >
                                            Ajouter au deck
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </main>
    )
}

export default Decks
