import { useEffect, useState } from "react";
import Card from "../components/Card";

import { API_BASE_URL } from "../config"

function Bazaar() {
    const serveur = API_BASE_URL
    const [cartes, setAllCartes] = useState(null)
    const [cartesFiltres, setCartes] = useState(null)
    const [nomCarte, setNomCarte] = useState("")
    const [mana, setMana] = useState("")
    const [dmg, setDmg] = useState("")
    const [rarete, setRarete] = useState("")
    const [vie, setVie] = useState("")
    const [prixMax, setPrixMax] = useState("")
    const [carteSelectionnee, setCarteSelectionnee] = useState(null)
    const token = localStorage.getItem("token")

    // useEffect pour récuperer les cartes du bazaar au chargement de la page
    useEffect(() => {
        async function getCartes() {
            const reponse = await fetch(`${serveur}/collection/all`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (reponse.ok) {
                const data = await reponse.json()
                setAllCartes(data)
                setCartes(data)
            }
        }
        getCartes().then(() => { console.log("cartes du bazaar récupérées de l'API") })
    }, [token])

    // useEffect pour filtrer les cartes, change lorsqu'un des filtres est changé
    useEffect(() => {
        function filtrerCartes() {
            // si pas encore loadé, return pour ne pas faire crash
            if (cartes === null) return

            let resultats = cartes

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
                resultats = resultats.filter((a) => (a.valeur || 0) <= prixMax)
            }

            // cherche tous les cartes qui ont le nom choisi, appliqué par dessus les autres filtres
            if (nomCarte !== "") {
                resultats = resultats.filter((a) => a.nom_carte.toLowerCase().includes(nomCarte.toLowerCase()))
            }
            setCartes(resultats)
        }
        filtrerCartes()
    }, [nomCarte, mana, dmg, rarete, vie, prixMax, cartes])

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
                            {cartesFiltres.map((carte) => (
                                <Card
                                    key={carte.id_carte}
                                    carte={carte}
                                    onClick={() => setCarteSelectionnee(carte)}
                                />
                            ))}
                        </div>
                    }
                </div>
            </div>
        </main>
    )
}

export default Bazaar
