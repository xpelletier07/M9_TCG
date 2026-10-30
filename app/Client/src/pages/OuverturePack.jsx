import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { API_BASE_URL } from '../config'
import '../css/OuverturePack.css'
import { useAuth } from '../auth/AuthContext'

const rareteLabels = {
    1: 'Commun',
    2: 'Rare',
    3: 'Épique',
    4: 'Légendaire',
}
// récupérer le token du local storage
const token = localStorage.getItem("token")

function OuverturePack() {
    const { user } = useAuth()
    const params = useParams()
    const navigate = useNavigate()
    const [cartes, setCartes] = useState([])
    const [cartesRetournees, setCartesRetournees] = useState(() => new Set())
    const [chargement, setChargement] = useState(true)
    const [erreur, setErreur] = useState(null)

    useEffect(() => {
        async function chargerCartes() {
            setChargement(true)
            setErreur(null)
            setCartesRetournees(new Set())
            try {
                const reponse = await fetch(`${API_BASE_URL}/cards/openPack/${params.idPack}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                })
                const cartesSelectionnees = await reponse.json()

                if (!reponse.ok) {
                    throw new Error(cartesSelectionnees.error || "Impossible de charger les cartes du pack.")
                }

                const detailsCartes = await Promise.all(
                    cartesSelectionnees.map(async ({ id_carte: idCarte }) => {
                        // Lorsqu'on a les cartes selectionnées, ajoute les cartes à l'inventaire du joueur
                        const reponseAjout = await fetch(`${API_BASE_URL}/carteInventaire/${user.id}/${idCarte}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` }
                        })
                        if (!reponseAjout.ok) {
                            throw new Error("Erreur lors de l'ajout à l'inventaire.")
                        }
                        // puis récupère l'affichage
                        const reponseCarte = await fetch(`${API_BASE_URL}/api/card/${idCarte}`)
                        if (!reponseCarte.ok) {
                            throw new Error("Une carte du pack est introuvable.")
                        }
                        return reponseCarte.json()
                    })
                )
                setCartes(detailsCartes)
            } catch (err) {
                setCartes([])
                setErreur(err.message)
            } finally {
                setChargement(false)
            }
        }
        chargerCartes()
    }, [])

    function retournerCarte(index) {
        setCartesRetournees((cartesActuelles) => {
            if (cartesActuelles.has(index)) return cartesActuelles
            const nouvellesCartes = new Set(cartesActuelles)
            nouvellesCartes.add(index)
            return nouvellesCartes
        })
    }

    const toutesRetournees = cartes.length > 0 && cartesRetournees.size === cartes.length

    return (
        <main className="content-left-spacing pack-opening-page">
            <header className="pack-opening-header">
                <p className="pack-opening-kicker">Ouverture du pack</p>
                <h1>Votre nouveau pack</h1>
                <p>Cliquez sur chaque carte pour la révéler.</p>
            </header>

            {chargement && (
                <div className="pack-opening-message">
                    <span className="loader" aria-hidden="true"></span>
                    <p>Préparation des cartes...</p>
                </div>
            )}

            {!chargement && erreur && (
                <div className="pack-opening-message pack-opening-message--error">
                    <p>{erreur}</p>
                    <button className="button is-light" type="button" onClick={() => navigate('/inventaire')}>
                        Retour à l'inventaire
                    </button>
                </div>
            )}

            {!chargement && !erreur && (
                <section className="pack-opening-grid" aria-label="Cartes du pack">
                    {cartes.map((carte, index) => {
                        const estRetournee = cartesRetournees.has(index)

                        return (
                            <button
                                className={`pack-reveal-card${estRetournee ? ' is-revealed' : ''}`}
                                type="button"
                                key={`${carte.id_carte ?? 'carte'}-${index}`}
                                onClick={() => retournerCarte(index)}
                                aria-label={estRetournee ? `${carte.nom_carte}, carte révélée` : `Révéler la carte ${index + 1}`}
                                aria-pressed={estRetournee}
                            >
                                <span className="pack-reveal-card__inner">
                                    <span className="pack-reveal-card__face pack-reveal-card__back" aria-hidden={estRetournee}>
                                        <span className="pack-reveal-card__back-frame">
                                            <i className="fa-solid fa-bolt" aria-hidden="true"></i>
                                            <strong>M9 TCG</strong>
                                        </span>
                                    </span>

                                    <span className={`pack-reveal-card__face pack-reveal-card__front inventory-card inventory-card--rarity-${carte.rarete}`} aria-hidden={!estRetournee}>
                                        <span className="inventory-card__eyebrow">
                                            <span className="inventory-card__rank">
                                                {rareteLabels[carte.rarete] ?? 'Carte'}
                                            </span>
                                            <span className="inventory-card__serial">
                                                ID {String(carte.id_carte).padStart(3, '0')}
                                            </span>
                                        </span>
                                        <span className="inventory-card__image-frame">
                                            <img
                                                src={carte.image}
                                                alt=""
                                                className="inventory-card__image"
                                            />
                                        </span>
                                        <span className="inventory-card__content">
                                            <strong className="inventory-card__name">{carte.nom_carte}</strong>
                                            <span className="inventory-card__description">{carte.description}</span>
                                            <span className="inventory-card__stats">
                                                <span className="inventory-card__stat inventory-card__stat--mana">
                                                    <span>Mana</span><strong>{carte.mana}</strong>
                                                </span>
                                                <span className="inventory-card__stat inventory-card__stat--health">
                                                    <span>Vie</span><strong>{carte.health}</strong>
                                                </span>
                                                <span className="inventory-card__stat inventory-card__stat--damage">
                                                    <span>ATQ</span><strong>{carte.damage}</strong>
                                                </span>
                                            </span>
                                        </span>
                                    </span>
                                </span>
                            </button>
                        )
                    })}
                </section>
            )}

            {toutesRetournees && (
                <div className="pack-opening-complete">
                    <button className="button is-link is-medium" type="button" onClick={() => navigate('/inventaire')}>
                        Retour à l'inventaire
                    </button>
                </div>
            )}
        </main>
    )
}

export default OuverturePack
