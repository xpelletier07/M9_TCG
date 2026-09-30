import { useState, useEffect } from 'react'

import { useAuth } from '../auth/AuthContext'
import { API_BASE_URL } from '../config'

// Import Bulma CSS
import 'bulma/css/bulma.min.css';

function Inventaire() {
    const { user } = useAuth()
    const [cartes, setCartes] = useState([])
    const [loading, setLoading] = useState(true)
    const [erreur, setErreur] = useState(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [collectionCartes, setCollectionCartes] = useState([])
    const [filtreNom, setFiltreNom] = useState('')
    const [isCollectionLoading, setIsCollectionLoading] = useState(false)

    // Fonction qui appelle les routes de inventaire.js pour récupérer les cartes de l'utilisateur
    async function fetchCartes() {
        if (!user) return // Si l'utilisateur n'est pas connecté, on ne fait rien
        try {
            setLoading(true)
            setErreur(null)
            // 1. Récupérer les entrées d'inventaire de l'utilisateur
            const reponseInventaire = await fetch(`${API_BASE_URL}/inventaire/${user.id}`)
            if (!reponseInventaire.ok) {
                throw new Error("Erreur lors de la récupération de l'inventaire")
            }
            const inventaire = await reponseInventaire.json()
            const entries = inventaire.cartes || []

            // 2. Pour chaque entrée, récupérer les détails complets de la carte
            const detailsCartes = await Promise.all(
                entries.map(async (entry) => {
                    const reponseCarte = await fetch(`${API_BASE_URL}/api/card/${entry.id_carte}`)
                    if (!reponseCarte.ok) return null
                    return await reponseCarte.json()
                })
            )

            // Filtrer les nulls (cartes qui n'ont pas pu être récupérées)
            setCartes(detailsCartes.filter(carte => carte !== null))
        } catch (err) {
            console.error("Erreur fetchCartes:", err)
            setErreur(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Fonction pour récupérer la collection complète
    async function fetchCollection() {
        if (collectionCartes.length > 0) return // Déjà chargé
        try {
            setIsCollectionLoading(true)
            const res = await fetch(`${API_BASE_URL}/collection/all`)
            if (!res.ok) throw new Error("Erreur lors de la récupération de la collection")
            const data = await res.json()
            setCollectionCartes(data)
        } catch (err) {
            console.error("Erreur fetchCollection:", err)
        } finally {
            setIsCollectionLoading(false)
        }
    }

    function handleOpenModal() {
        setIsModalOpen(true)
        fetchCollection()
    }

    // Fonction pour ajouter une carte à l'inventaire
    async function handleAddCard(carte) {
        if (!user) return
        try {
            const res = await fetch(`${API_BASE_URL}/carteInventaire/${user.id}/${carte.id_carte}`, {
                method: 'POST'
            })
            if (!res.ok) {
                console.error("Erreur lors de l'ajout")
                return
            }
            setIsModalOpen(false)
            fetchCartes() // Rafraîchir l'inventaire
        } catch (err) {
            console.error("Erreur handleAddCard:", err)
        }
    }

    // Fetch les cartes une fois que le composant est monté
    useEffect(() => {
        fetchCartes()
    }, [user])

    return (
        <main className="content-left-spacing">
            {/* En-tête (Titres + Actions) */}
            <div className="inventory-header">
                <div>
                    <h1 className="inventory-title">Inventaire de cartes</h1>
                </div>
                <div className="inventory-actions is-flex" style={{ gap: '0.5rem' }}>
                    <button className="button is-link admin-addcard-button" onClick={handleOpenModal}>
                        <span className="icon">
                            <i className="fas fa-plus"></i>
                        </span>
                        <span>Ajouter une carte</span>
                    </button>
                    <button className="button is-warning decks-button">
                        <span className="icon">
                            <i className="fas fa-layer-group"></i>
                        </span>
                        <span>Decks</span>
                    </button>
                </div>
            </div>
            <p className="inventory-subtitle">C&apos;est trop bien les cartes ngl</p>
            <hr className="inventory-divider" />

            {/* Filtres */}
            <div className="filters">
                <div className="field filter-text">
                    <label className="label">Filtres</label>
                    <div className="control">
                        <input className="input" type="text" placeholder="Text input" />
                    </div>
                </div>
            </div>

            {/* Liste des Cartes */}
            <div className="cards-container">
                {loading && (
                    <div className="cards-loading">
                        <span className="loader"></span>
                        <p>Chargement des cartes...</p>
                    </div>
                )}

                {erreur && (
                    <div className="cards-error">
                        <p>⚠️ {erreur}</p>
                        <button className="button is-small is-warning" onClick={fetchCartes}>
                            Réessayer
                        </button>
                    </div>
                )}

                {!loading && !erreur && cartes.length === 0 && (
                    <div className="cards-empty">
                        <p>Aucune carte dans votre inventaire.</p>
                    </div>
                )}

                {!loading && !erreur && cartes.length > 0 && (
                    <div className="cards-grid">
                        {cartes.map((carte) => (
                            <div key={carte.id_carte} className="card-item">
                                <div className="card-image-wrapper">
                                    <img
                                        src={carte.image}
                                        alt={carte.nom_carte}
                                        className="card-image"
                                    />
                                </div>
                                <div className="card-info">
                                    <h3 className="card-name">{carte.nom_carte}</h3>
                                    <p className="card-description">{carte.description}</p>
                                    <div className="card-stats">
                                        <span className="stat stat-mana" title="Mana">💧 {carte.mana}</span>
                                        <span className="stat stat-health" title="Vie">❤️ {carte.health}</span>
                                        <span className="stat stat-damage" title="Dégâts">⚔️ {carte.damage}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal d'ajout de carte */}
            <div className={`modal ${isModalOpen ? 'is-active' : ''}`}>
                <div className="modal-background" onClick={() => setIsModalOpen(false)}></div>
                <div className="modal-card" style={{ width: '80%', maxWidth: '800px' }}>
                    <header className="modal-card-head">
                        <p className="modal-card-title">Ajouter une carte à l'inventaire</p>
                        <button className="delete" aria-label="close" onClick={() => setIsModalOpen(false)}></button>
                    </header>
                    <section className="modal-card-body">
                        <div className="field">
                            <label className="label">Rechercher par nom</label>
                            <div className="control">
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Nom de la carte..."
                                    value={filtreNom}
                                    onChange={(e) => setFiltreNom(e.target.value)}
                                />
                            </div>
                        </div>

                        {isCollectionLoading ? (
                            <div className="cards-loading">
                                <span className="loader"></span>
                                <p>Chargement de la collection...</p>
                            </div>
                        ) : (
                            <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                                {collectionCartes
                                    .filter(c => c.nom_carte.toLowerCase().includes(filtreNom.toLowerCase()))
                                    .map(carte => (
                                        <div
                                            key={carte.id_carte}
                                            className="card-item"
                                            onClick={() => handleAddCard(carte)}
                                        >
                                            <div className="card-image-wrapper">
                                                <img
                                                    src={carte.image}
                                                    alt={carte.nom_carte}
                                                    className="card-image"
                                                />
                                            </div>
                                            <div className="card-info" style={{ padding: '0.85rem' }}>
                                                <h3 className="card-name" style={{ fontSize: '0.9rem' }}>{carte.nom_carte}</h3>
                                                <div className="card-stats">
                                                    <span className="stat stat-mana" title="Mana">💧 {carte.mana}</span>
                                                    <span className="stat stat-health" title="Vie">❤️ {carte.health}</span>
                                                    <span className="stat stat-damage" title="Dégâts">⚔️ {carte.damage}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                {collectionCartes.filter(c => c.nom_carte.toLowerCase().includes(filtreNom.toLowerCase())).length === 0 && (
                                    <p className="has-text-grey">Aucune carte trouvée pour "{filtreNom}"</p>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>

        </main>
    )
}

export default Inventaire