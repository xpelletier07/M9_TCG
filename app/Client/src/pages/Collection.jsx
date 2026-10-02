import { useEffect, useState } from "react";
import { CardModal } from "../components/Modals";

import { API_BASE_URL } from "../config"

const nouvelleCarte = {
    nom_carte: "",
    image: "",
    description: "",
    rarete: 1,
    valeur: 0,
    mana: 0,
    health: 0,
    damage: 0,
};

function Collection() {
    const serveur = API_BASE_URL
    const [cartes, setAllCartes] = useState(null)
    const [cartesFiltres, setCartes] = useState(null)
    const [nomCarte, setNomCarte] = useState("")
    const [mana, setMana] = useState("")
    const [dmg, setDmg] = useState("")
    const [rarete, setRarete] = useState("")
    const [vie, setVie] = useState("")
    const [carteSelectionnee, setCarteSelectionnee] = useState(null)
    const [ajoutCarteOuvert, setAjoutCarteOuvert] = useState(false)
    // variable pour vérifier si l'utilisateur connecté est administrateur, utilisé seulement pour l'affichage, check aussi coté serveur
    const [isAdmin, setIsAdmin] = useState(false)
    // mini constante pour avoir une liste de 1-10, utilisée pour faire l'affichage des filtres
    const listeCompte = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    // récupérer le token du local storage
    const token = localStorage.getItem("token")

    // useEffect pour récuperer les cartes au chargement de la page
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
        getCartes().then(() => { console.log("cartes récupérés de l'API") })
    }, [token])

    // useEffect pour checker si l'utilisateur est un admin pour l'affichage dans les modals
    useEffect(() => {
        async function getMe() {
            const reponse = await fetch(`${serveur}/auth/whoAmI`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!reponse.ok) {
                setIsAdmin(false)
                return
            }
            const user = await reponse.json()
            if (user.statut === "admin") setIsAdmin(true)
        }
        getMe()
    }, [token])

    // useEffect pour filtrer les cartes, change lorsqu'un des filtres est changé (nom, rareté, vie, mana, dmg)
    useEffect(() => {
        function filtrerCartes() {
            // si pas encore loadé, return pour ne pas faire crash
            if (cartes === null) return

            let resultats = cartes
            // reset les filtres
            setCartes(cartes)

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

            // cherche tous les cartes qui ont le nom choisi, appliqué par dessus les autres filtres
            if (nomCarte !== "") {
                // change les cartes filtrés en prennant la liste déjà filtrée 
                // filtre en comparant si le nom (en lower case) comprennent le contenu de la barre de recherche (en lower case)
                resultats = resultats.filter((a) => a.nom_carte.toLowerCase().includes(nomCarte.toLowerCase()))
            }
            setCartes(resultats)
        }
        filtrerCartes()
    }, [nomCarte, mana, dmg, rarete, vie, cartes])

    return (
        <main className="content-left-spacing">
            <div className="container">
                <div className="section">
                    <div className="columns">
                        <div className="column has-text-centered">
                            <h1 className="title">Collection</h1><br />
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
                                        <div className="select is-fullwidth">
                                            <select onChange={(e) => setMana(e.target.value)}>
                                                <option></option>
                                                {listeCompte.map((a) => {
                                                    return <option key={a}>{a}</option>
                                                })}
                                            </select>
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
                                        <div className="select is-fullwidth">
                                            {cartes != null &&
                                                <select onChange={(e) => setDmg(e.target.value)}>
                                                    <option></option>
                                                    {listeCompte.map((a) => {
                                                        return <option key={a}>{a}</option>
                                                    })}

                                                </select>
                                            }
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
                                        <div className="select is-fullwidth">
                                            {cartes != null &&
                                                <select onChange={(e) => setVie(e.target.value)}>
                                                    <option></option>
                                                    {listeCompte.map((a) => {
                                                        return <option key={a}>{a}</option>
                                                    })}
                                                </select>
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* boutton pour ajouter une carte dans la collection 
                        s'affiche seulement lorsque l'utilisateur connecté est admin*/}
                    {isAdmin &&
                        <div className="field">
                            <div className="control">
                                <button type="button" className="button is-success" style={{ marginRight: "1em" }}
                                    onClick={() => setAjoutCarteOuvert(true)}>
                                    Ajouter une carte
                                </button>
                            </div>
                        </div>
                    }
                    {ajoutCarteOuvert && (
                        <CardModal
                            carte={nouvelleCarte}
                            isNew={true}
                            isAdmin={isAdmin}
                            token={token}
                            onClose={() => setAjoutCarteOuvert(false)}
                            onUpdated={(carteAjoutee) => {
                                setAllCartes((cartesActuelles) => [carteAjoutee, ...cartesActuelles]);
                                setAjoutCarteOuvert(false);
                            }}
                        />
                    )}
                    {cartesFiltres != null &&
                        <div className="row columns is-multiline">
                            {cartesFiltres.map((a) => {
                                return (
                                    <>
                                        <div className="column is-3">
                                            <div className="card large" onClick={() => { setCarteSelectionnee(a) }}>
                                                <div className="card-image">
                                                    <figure className="image is-square">
                                                        <img src={a.image} alt={`Image de la carte ${a.nom_carte}`} />
                                                    </figure>
                                                </div>
                                                <div className="card-content">
                                                    <div className="media">
                                                        <div className="media-content">
                                                            <p className="title is-4 no-padding">{a.nom_carte}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )
                            })}
                            {/* s'affiche seulement si isAdmin == true, si on modifie ou delete la carte dans le modal
                                re-fait l'affichage */}
                            <CardModal carte={carteSelectionnee} isNew={false} isAdmin={isAdmin} token={token}
                                onClose={() => setCarteSelectionnee(null)} onUpdated={(carteModifiee) => {
                                    setAllCartes((cartesActuelles) =>
                                        cartesActuelles.map((carte) => carte.id_carte === carteModifiee.id_carte
                                            ? carteModifiee
                                            : carte
                                        )
                                    )
                                    setCarteSelectionnee(carteModifiee);
                                }}
                                onDeleted={(idCarte) => {
                                    setAllCartes((cartesActuelles) =>
                                        cartesActuelles.filter(
                                            (carte) => carte.id_carte !== idCarte
                                        )
                                    );
                                    setCarteSelectionnee(null);
                                }}
                            />
                        </div>
                    }
                </div>
            </div>
        </main>
    )
}

export default Collection