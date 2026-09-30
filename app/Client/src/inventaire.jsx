import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import { useAuth } from './auth/AuthContext'
import { API_BASE_URL } from './config'

// Import Bulma CSS
import 'bulma/css/bulma.min.css';

function Inventaire() {
    const { user } = useAuth()
    const [cartes, setCartes] = useState([])
    const [loading, setLoading] = useState(true)
    const [erreur, setErreur] = useState(null)

    // Fonction qui appelle les routes de inventaire.js pour récupérer les cartes de l'utilisateur
    async function fetchCartes() {
        if (!user) return // Si l'utilisateur n'est pas connecté, on ne fait rien
        try {
            setLoading(true)
            setErreur(null)
            // 1. Récupérer les entrées d'inventaire de l'utilisateur
            const reponseInventaire = await fetch(`${API_BASE_URL}/inventaire/getInventaire/${user.id}`)
            if (!reponseInventaire.ok) {
                throw new Error("Erreur lors de la récupération de l'inventaire")
            }
            const inventaire = await reponseInventaire.json()
            const entries = inventaire.cartes || []

            // 2. Pour chaque entrée, récupérer les détails complets de la carte
            const detailsCartes = await Promise.all(
                entries.map(async (entry) => {
                    const reponseCarte = await fetch(`${API_BASE_URL}/api/carte/${entry.id_carte}`)
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

    // Fetch les cartes une fois que le composant est monté
    useEffect(() => {
        fetchCartes()
    }, [user])

    return (
        <div className="tcg-layout">
            <Sidebar />

            <main className="content-left-spacing">
                {/* En-tête (Titres + Actions) */}
                <div className="inventory-header">
                    <div>
                        <h1 className="inventory-title">Inventaire de cartes</h1>
                    </div>
                    <button className="button is-warning decks-button">
                        <span className="icon">
                            <i className="fas fa-layer-group"></i>
                        </span>
                        <span>Decks</span>
                    </button>
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


            </main>
        </div>
    )
}

export default Inventaire