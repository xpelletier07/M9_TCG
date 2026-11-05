import { useCallback, useEffect, useState } from "react";
import Card from "../components/Card";

import { API_BASE_URL } from "../config"

function Bazaar() {
    const serveur = API_BASE_URL
    const [allCartes, setAllCartes] = useState(null)
    const [cartesFiltres, setCartesFiltres] = useState(null)
    const [nomCarte, setNomCarte] = useState("")
    const [mana, setMana] = useState("")
    const [dmg, setDmg] = useState("")
    const [rarete, setRarete] = useState("")
    const [vie, setVie] = useState("")
    const [prixMax, setPrixMax] = useState("")
    const [carteSelectionnee, setCarteSelectionnee] = useState(null)
    const [quantiteAchat, setQuantiteAchat] = useState(1)
    const [messageAchat, setMessageAchat] = useState(null)
    const [achatEnCours, setAchatEnCours] = useState(false)
    const token = localStorage.getItem("token")

    // récupère les offres de vente (carte, vendeur, quantité et prix unitaire)
    const getCartes = useCallback(async () => {
        const reponse = await fetch(`${serveur}/bazaar/offres`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (reponse.ok) {
            const data = await reponse.json()
            setAllCartes(data)
        }
    }, [serveur, token])

    // useEffect pour récuperer les cartes du bazaar au chargement de la page
    useEffect(() => {
        async function chargerCartes() {
            await getCartes()
        }
        chargerCartes()
    }, [getCartes])

    function ouvrirAchat(carte) {
        setCarteSelectionnee(carte)
        setQuantiteAchat(1)
        setMessageAchat(null)
    }

    function fermerAchat() {
        setCarteSelectionnee(null)
        setMessageAchat(null)
    }

    // achète la quantité choisie de l'offre sélectionnée, au prix fixé par le vendeur
    async function acheter() {
        setAchatEnCours(true)
        setMessageAchat(null)
        try {
            const reponse = await fetch(`${serveur}/bazaar/acheter`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id_offre: carteSelectionnee.id_offre, quantite: quantiteAchat })
            })
            const data = await reponse.json()
            if (reponse.ok) {
                setMessageAchat({ type: "success", texte: `Achat réussi : ${quantiteAchat} × ${carteSelectionnee.nom_carte} pour ${data.total} crédits.` })
                await getCartes()
            } else {
                setMessageAchat({ type: "danger", texte: data.error || data.errors?.[0]?.msg || "Erreur lors de l'achat" })
            }
        } catch {
            setMessageAchat({ type: "danger", texte: "Erreur de connexion au serveur" })
        } finally {
            setAchatEnCours(false)
        }
    }

    // useEffect pour filtrer les cartes, change lorsqu'un des filtres est changé
    useEffect(() => {
        function filtrerCartes() {
            // si pas encore loadé, return pour ne pas faire crash
            if (allCartes === null) return

            let resultats = allCartes

            // applique les filtres de toutes les options en premier, puis le nom
            if (mana !== "") {
                resultats = resultats.filter((a) => a.mana == mana)
            }
            if (dmg !== "") {
                resultats = resultats.filter((a) => a.damage == dmg)
            }
            if (rarete !== "") {
                resultats = resultats.filter((a) => a.rarete == rarete)
            }
            if (vie !== "") {
                resultats = resultats.filter((a) => a.health == vie)
            }
            if (prixMax !== "") {
                resultats = resultats.filter((a) => Number(a.prix_unitaire) <= Number(prixMax))
            }

            // cherche tous les cartes qui ont le nom choisi, appliqué par dessus les autres filtres
            if (nomCarte !== "") {
                resultats = resultats.filter((a) => a.nom_carte.toLowerCase().includes(nomCarte.toLowerCase()))
            }
            setCartesFiltres(resultats)
        }
        filtrerCartes()
    }, [nomCarte, mana, dmg, rarete, vie, prixMax, allCartes])

    return (
        <main className="content-left-spacing">
            <div className="container">
                <div className="section">
                    <div className="columns">
                        <div className="column has-text-centered">
                            <h1 className="title">Bazaar - Marché des Cartes</h1><br />
                        </div>
                    </div>
                    {/* label et filtre pour le nom de la carte */}
                    <div className="columns">
                        <div className="field is-horizontal">
                            <div className="field-label is-normal">
                                <label className="label">Carte</label>
                            </div>
                            <div className="field-body">
                                <div className="field">
                                    <p className="control is-expanded">
                                        <input className="input" type="text" placeholder="Nom de la carte" onChange={(e) => setNomCarte(e.target.value)} />
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* label et filtre pour la rareté de la carte */}
                        <div className="field is-horizontal" style={{ paddingLeft: "20px" }}>
                            <div className="field-label is-normal">
                                <label className="label">Rareté</label>
                            </div>
                            <div className="field-body">
                                <div className="field">
                                    <div className="control" style={{ minWidth: "100px" }}>
                                        <div className="select is-fullwidth">
                                            <select onChange={(e) => setRarete(e.target.value)}>
                                                <option></option>
                                                {/* value de 1-4 pour check comme dans la bd */}
                                                <option value={1}>Commun</option>
                                                <option value={2}>Rare</option>
                                                <option value={3}>Epique</option>
                                                <option value={4}>Légendaire</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* label et filtre pour le mana de la carte */}
                        <div className="field is-horizontal" style={{ paddingLeft: "20px" }}>
                            <div className="field-label is-normal">
                                <label className="label">Mana</label>
                            </div>
                            <div className="field-body">
                                <div className="field">
                                    <div className="control" style={{ minWidth: "75px" }}>
                                        <div className="is-fullwidth">
                                            <input className="input" type="number" min={"0"} max={"10"} onChange={(e) => setMana(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* label et filtre pour l'attaque de la carte */}
                        <div className="field is-horizontal" style={{ paddingLeft: "20px" }}>
                            <div className="field-label is-normal">
                                <label className="label">Attaque</label>
                            </div>
                            <div className="field-body">
                                <div className="field">
                                    <div className="control" style={{ minWidth: "75px" }}>
                                        <div className="is-fullwidth">
                                            <input className="input" type="number" min={"0"} max={"1000"} onChange={(e) => setDmg(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* label et filtre pour la vie de la carte */}
                        <div className="field is-horizontal" style={{ paddingLeft: "20px" }}>
                            <div className="field-label is-normal">
                                <label className="label">Vie</label>
                            </div>
                            <div className="field-body">
                                <div className="field">
                                    <div className="control" style={{ minWidth: "75px" }}>
                                        <div className="is-fullwidth">
                                            <input className="input" type="number" min={"1"} max={"1000"} onChange={(e) => setVie(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filtre pour le prix maximum */}
                    <div className="columns">
                        <div className="field is-horizontal">
                            <div className="field-label is-normal">
                                <label className="label">Prix Max</label>
                            </div>
                            <div className="field-body">
                                <div className="field">
                                    <div className="control" style={{ minWidth: "100px" }}>
                                        <div className="is-fullwidth">
                                            <input className="input" type="number" min={"0"} placeholder="Aucun limite" onChange={(e) => setPrixMax(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bouton pour ajouter une carte a vendre */}
                    <div className="field">
                        <div className="control">
                            <button type="button" className="button is-success" style={{ marginRight: "1em" }}>
                                Ajouter une carte à vendre
                            </button>
                        </div>
                    </div>

                    {/* Affichage des cartes filtrées */}
                    {cartesFiltres != null &&
                        <div className="inventory-cards-grid">
                            {cartesFiltres.map((offre) => (
                                <div key={offre.id_offre}>
                                    <Card
                                        carte={offre}
                                        quantite={offre.quantite}
                                        onClick={() => ouvrirAchat(offre)}
                                    />
                                    <p className="has-text-centered">
                                        <strong>{offre.prix_unitaire} crédits</strong> chacune · {offre.quantite} en vente
                                    </p>
                                    <p className="has-text-centered is-size-7">Vendeur : {offre.vendeur}</p>
                                </div>
                            ))}
                        </div>
                    }
                    {cartesFiltres != null && cartesFiltres.length === 0 &&
                        <p className="has-text-centered">Aucune carte en vente pour le moment.</p>
                    }

                    {/* Fenêtre d'achat */}
                    {carteSelectionnee &&
                        <div className="modal is-active">
                            <div className="modal-background" onClick={fermerAchat}></div>
                            <div className="modal-card">
                                <header className="modal-card-head">
                                    <p className="modal-card-title">Acheter {carteSelectionnee.nom_carte}</p>
                                    <button type="button" className="delete" aria-label="close" onClick={fermerAchat}></button>
                                </header>
                                <section className="modal-card-body">
                                    <p>Vendeur : <strong>{carteSelectionnee.vendeur}</strong></p>
                                    <p><strong>{carteSelectionnee.prix_unitaire} crédits</strong> chacune ({carteSelectionnee.quantite} disponible(s))</p>
                                    <div className="field mt-4">
                                        <label className="label">Quantité</label>
                                        <input
                                            className="input"
                                            type="number"
                                            min={1}
                                            max={carteSelectionnee.quantite}
                                            value={quantiteAchat}
                                            onChange={(e) => setQuantiteAchat(Math.min(carteSelectionnee.quantite, Math.max(1, Number(e.target.value) || 1)))}
                                        />
                                    </div>
                                    <p className="help">Total : {Math.round(carteSelectionnee.prix_unitaire * quantiteAchat * 100) / 100} crédits</p>
                                    {messageAchat &&
                                        <div className={`notification is-${messageAchat.type} mt-4`}>{messageAchat.texte}</div>
                                    }
                                </section>
                                <footer className="modal-card-foot">
                                    <button type="button" className="button is-success" disabled={achatEnCours || messageAchat?.type === "success"} onClick={acheter}>
                                        Acheter
                                    </button>
                                    <button type="button" className="button" onClick={fermerAchat}>Fermer</button>
                                </footer>
                            </div>
                        </div>
                    }
                </div>
            </div>
        </main>
    )
}

export default Bazaar
