import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { API_BASE_URL } from '../config'
import { CardModal } from '../components/Modals'
import Card from '../components/Card'

// Import Bulma CSS
import 'bulma/css/bulma.min.css';

function Inventaire() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [cartes, setCartes] = useState([])
    const [loading, setLoading] = useState(true)
    const [erreur, setErreur] = useState(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [collectionCartes, setCollectionCartes] = useState([])
    const [filtreNom, setFiltreNom] = useState('')
    const [isCollectionLoading, setIsCollectionLoading] = useState(false)
    const [carteSelectionnee, setCarteSelectionnee] = useState(null)
    const [packs, setPacks] = useState([])
    const [packsDeplies, setPacksDeplies] = useState(false)
    const [packEnOuverture, setPackEnOuverture] = useState(null)
    // récupérer le token du local storage
    const token = localStorage.getItem("token")

    // fonction pour obtenir les packs de l'utilisateur
    async function fetchPacks() {
        if (!user) return
        try {
            setLoading(true)
            setErreur(null)
            const reponse = await fetch (`${API_BASE_URL}/inventaire-pack/me`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (reponse.ok) {
                const data = await reponse.json()
                setPacks(data)
            }
        }catch (err) {
            console.error("Erreur fetchPacks: ", err)
            setErreur(err.message)
        } finally {
            setLoading(false)
        }
    } 

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
            const token = localStorage.getItem("token")
            const res = await fetch(`${API_BASE_URL}/collection/all`, {
                headers: { Authorization: `Bearer ${token}` }
            })
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

    async function handleOpenPack(pack) {
        if (packEnOuverture !== null) return

        setPackEnOuverture(pack.id_pack)
        setErreur(null)

        try {
            const reponse = await fetch(`${API_BASE_URL}/inventaire-pack/${pack.id_pack}/open`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await reponse.json()

            if (!reponse.ok) {
                throw new Error(data.error || "Erreur lors de l'ouverture du pack")
            }

            navigate(`/ouverture-pack/${data.pack.id_pack}`)
        } catch (err) {
            setErreur(err.message)
            setPackEnOuverture(null)
        }
    }

    // Fetch les cartes une fois que le composant est monté
    useEffect(() => {
        fetchCartes()
        fetchPacks()
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
                    <button
                        className="button is-info"
                        type="button"
                        aria-expanded={packsDeplies}
                        aria-controls="inventory-packs"
                        onClick={() => setPacksDeplies((deplies) => !deplies)}
                    >
                        <span className="icon">
                            <i className={`fas fa-chevron-${packsDeplies ? 'up' : 'down'}`}></i>
                        </span>
                        <span>Packs</span>
                    </button>
                    <button className="button is-warning decks-button" onClick={() => navigate('/decks')}>
                        <span className="icon">
                            <i className="fas fa-layer-group"></i>
                        </span>
                        <span>Decks</span>
                    </button>
                </div>
            </div>
            <p className="inventory-subtitle">C'est trop bien les cartes ngl</p>
            <hr className="inventory-divider" />

            {/* boosters packs du joueur */}
            {packsDeplies && (
                <section id="inventory-packs" className="box mb-5">
                    <h2 className="title is-4">Mes packs</h2>
                    {packs.length === 0 ? (
                        <p>Aucun pack dans votre inventaire.</p>
                    ) : (
                        <div className="columns is-multiline">
                            {packs.map((pack) => (
                                <div className="column is-6-tablet is-4-desktop is-3-widescreen" key={pack.id_pack}>
                                    <div className="card">
                                        {pack.image_pack && (
                                            <div className="card-image">
                                                <figure className="image is-square">
                                                    <img
                                                        src={pack.image_pack}
                                                        alt={pack.nom_pack}
                                                        style={{ objectFit: 'contain' }}
                                                    />
                                                </figure>
                                            </div>
                                        )}
                                        <div className="card-content">
                                            <p className="title is-5">{pack.nom_pack}</p>
                                            {pack.description_pack && (
                                                <p className="content">{pack.description_pack}</p>
                                            )}
                                            <span className="tag is-info is-medium">
                                                Quantité : {pack.quantite}
                                            </span>
                                            <button
                                                className={`button is-link is-fullwidth mt-4${packEnOuverture === pack.id_pack ? ' is-loading' : ''}`}
                                                type="button"
                                                disabled={packEnOuverture !== null}
                                                onClick={() => handleOpenPack(pack)}
                                            >
                                                Ouvrir le pack
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}



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
                    <div className="inventory-cards-grid">
                        {cartes.map((carte) => (
                            <Card
                                key={carte.id_carte}
                                carte={carte}
                                onClick={() => setCarteSelectionnee(carte)}
                            />
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
                                    .filter(c => (c?.nom_carte || "").toLowerCase().includes(filtreNom.toLowerCase()))
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
                                {collectionCartes.filter(c => (c?.nom_carte || "").toLowerCase().includes(filtreNom.toLowerCase())).length === 0 && (
                                    <p className="has-text-grey">Aucune carte trouvée pour "{filtreNom}"</p>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {/* Modal de visualisation de carte */}
            <CardModal
                isOpen={carteSelectionnee !== null}
                carte={carteSelectionnee}
                isAdmin={false}
                token={null}
                onClose={() => setCarteSelectionnee(null)}
                onUpdated={() => {}}
                onDeleted={() => {}}
            />
        </main>
    )
}

export default Inventaire