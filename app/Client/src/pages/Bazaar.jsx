import { useCallback, useEffect, useState } from "react";
import Card from "../components/Card";
import "../css/Bazaar.css";

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
    const [offres, setOffres] = useState([])
    const [quantites, setQuantites] = useState({})
    const [quantiteMoinsChers, setQuantiteMoinsChers] = useState(1)
    const [messageAchat, setMessageAchat] = useState(null)
    const [achatEnCours, setAchatEnCours] = useState(false)
    const token = localStorage.getItem("token")

    // récupère toutes les cartes du jeu (avec le prix le plus bas) et toutes les offres de vente
    const getCartes = useCallback(async () => {
        const headers = { Authorization: `Bearer ${token}` }
        const [repCartes, repOffres] = await Promise.all([
            fetch(`${serveur}/bazaar/cartes`, { headers }),
            fetch(`${serveur}/bazaar/offres`, { headers })
        ])
        if (repCartes.ok) setAllCartes(await repCartes.json())
        if (repOffres.ok) setOffres(await repOffres.json())
    }, [serveur, token])

    // useEffect pour récuperer les cartes du bazaar au chargement de la page
    useEffect(() => {
        async function chargerCartes() {
            await getCartes()
        }
        chargerCartes()
    }, [getCartes])

    // clic sur une carte : affiche toutes les offres des vendeurs pour cette carte
    function ouvrirCarte(carte) {
        setCarteSelectionnee(carte)
        setQuantites({})
        setMessageAchat(null)
    }

    function fermerAchat() {
        setCarteSelectionnee(null)
        setMessageAchat(null)
    }

    // offres de la carte sélectionnée, triées du moins cher au plus cher (à prix égal : la plus ancienne d'abord)
    const offresCarte = carteSelectionnee
        ? offres
            .filter((o) => o.id_carte === carteSelectionnee.id_carte)
            .sort((a, b) => a.prix_unitaire - b.prix_unitaire || new Date(a.cree_le) - new Date(b.cree_le))
        : []

    function quantiteChoisie(offre) {
        return Math.min(offre.quantite, Math.max(1, quantites[offre.id_offre] ?? 1))
    }

    // coût des N exemplaires les moins chers (les offres arrivent déjà triées par prix croissant)
    const totalEnVente = offresCarte.reduce((somme, o) => somme + o.quantite, 0)
    const maxMoinsChers = Math.min(5, totalEnVente)
    const nbMoinsChers = Math.min(maxMoinsChers, Math.max(1, quantiteMoinsChers))
    let coutMoinsChers = 0
    let restantCout = nbMoinsChers
    for (const o of offresCarte) {
        const prise = Math.min(restantCout, o.quantite)
        coutMoinsChers += prise * o.prix_unitaire
        restantCout -= prise
    }
    coutMoinsChers = Math.round(coutMoinsChers * 100) / 100

    // achète les N exemplaires les moins chers de la carte, peu importe le vendeur
    async function acheterMoinsChers() {
        setAchatEnCours(true)
        setMessageAchat(null)
        try {
            const reponse = await fetch(`${serveur}/bazaar/acheter-moins-chers`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id_carte: carteSelectionnee.id_carte, quantite: nbMoinsChers })
            })
            const data = await reponse.json()
            if (reponse.ok) {
                setMessageAchat({ type: "success", texte: `Achat réussi : ${data.quantite} × ${carteSelectionnee.nom_carte} (${data.nb_offres} offre(s)) pour ${data.total} crédits.` })
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

    // achète la quantité choisie d'une offre précise, au prix fixé par le vendeur
    async function acheter(offre) {
        const quantite = quantiteChoisie(offre)
        setAchatEnCours(true)
        setMessageAchat(null)
        try {
            const reponse = await fetch(`${serveur}/bazaar/acheter`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id_offre: offre.id_offre, quantite })
            })
            const data = await reponse.json()
            if (reponse.ok) {
                setMessageAchat({ type: "success", texte: `Achat réussi : ${quantite} × ${offre.nom_carte} à ${offre.vendeur} pour ${data.total} crédits.` })
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
                resultats = resultats.filter((a) => a.prix_min !== null && Number(a.prix_min) <= Number(prixMax))
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

                    {/* Affichage de toutes les cartes du jeu */}
                    {cartesFiltres != null &&
                        <div className="inventory-cards-grid">
                            {cartesFiltres.map((carte) => (
                                <div key={carte.id_carte}>
                                    <Card carte={carte} onClick={() => ouvrirCarte(carte)} />
                                    <p className="has-text-centered">
                                        {carte.quantite_en_vente > 0
                                            ? <strong>À partir de {carte.prix_min} crédits</strong>
                                            : <span className="has-text-grey">Aucune offre</span>}
                                    </p>
                                    {carte.quantite_en_vente > 0 &&
                                        <p className="has-text-centered is-size-7">
                                            {carte.quantite_en_vente} en vente · {carte.nb_vendeurs} offre(s)
                                        </p>
                                    }
                                </div>
                            ))}
                        </div>
                    }
                    {cartesFiltres != null && cartesFiltres.length === 0 &&
                        <p className="has-text-centered">Aucune carte ne correspond aux filtres.</p>
                    }

                    {/* Fenêtre : offres de tous les vendeurs pour la carte cliquée */}
                    {carteSelectionnee &&
                        <div className={`modal is-active bazaar-modal bazaar-modal--rarity-${carteSelectionnee.rarete}`}>
                            <div className="modal-background" onClick={fermerAchat}></div>
                            <div className="modal-card" style={{ width: "min(900px, 95%)" }}>
                                <header className="modal-card-head">
                                    <p className="modal-card-title">{carteSelectionnee.nom_carte} — offres des vendeurs</p>
                                    <button type="button" className="delete" aria-label="close" onClick={fermerAchat}></button>
                                </header>
                                <section className="modal-card-body">
                                    <div className="bazaar-modal__carte">
                                        <Card carte={carteSelectionnee} onClick={() => {}} />
                                    </div>
                                    {offresCarte.length === 0 &&
                                        <p>Personne ne vend cette carte pour le moment.</p>
                                    }
                                    {offresCarte.length > 0 &&
                                        <div className="field has-addons mb-4">
                                            <div className="control">
                                                <div className="select">
                                                    <select value={nbMoinsChers} onChange={(e) => setQuantiteMoinsChers(Number(e.target.value))}>
                                                        {Array.from({ length: maxMoinsChers }, (_, i) => i + 1).map((n) => (
                                                            <option key={n} value={n}>{n}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="control">
                                                <button type="button" className="button is-primary" disabled={achatEnCours} onClick={acheterMoinsChers}>
                                                    {nbMoinsChers > 1 ? `Acheter les ${nbMoinsChers} moins chères` : "Acheter la moins chère"} ({coutMoinsChers} crédits)
                                                </button>
                                            </div>
                                        </div>
                                    }
                                    {offresCarte.length > 0 &&
                                        <table className="table is-fullwidth is-hoverable">
                                            <thead>
                                                <tr>
                                                    <th>Vendeur</th>
                                                    <th>Prix unitaire</th>
                                                    <th>Disponible</th>
                                                    <th>Quantité</th>
                                                    <th>Total</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {offresCarte.map((offre) => (
                                                    <tr key={offre.id_offre}>
                                                        <td>{offre.vendeur}</td>
                                                        <td>{offre.prix_unitaire} crédits</td>
                                                        <td>{offre.quantite}</td>
                                                        <td>
                                                            <input
                                                                className="input is-small"
                                                                style={{ width: "70px" }}
                                                                type="number"
                                                                min={1}
                                                                max={offre.quantite}
                                                                value={quantiteChoisie(offre)}
                                                                onChange={(e) => setQuantites({ ...quantites, [offre.id_offre]: Math.min(offre.quantite, Math.max(1, Number(e.target.value) || 1)) })}
                                                            />
                                                        </td>
                                                        <td>{Math.round(offre.prix_unitaire * quantiteChoisie(offre) * 100) / 100}</td>
                                                        <td>
                                                            <button type="button" className="button is-success is-small" disabled={achatEnCours} onClick={() => acheter(offre)}>
                                                                Acheter
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    }
                                    {messageAchat &&
                                        <div className={`notification is-${messageAchat.type} mt-4`}>{messageAchat.texte}</div>
                                    }
                                </section>
                                <footer className="modal-card-foot">
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
