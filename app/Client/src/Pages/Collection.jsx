import { useEffect, useState } from "react";

function Collection() {
    const serveur = ""
    const [albums, setAllAlbums] = useState(null)
    const [artistes, setAllArtistes] = useState(null)
    const [albumsFiltres, setAlbums] = useState(null)
    const [nomArtiste, setArtiste] = useState("")
    const [nomAlbum, setNomAlbum] = useState("")

    // useEffect pour récuperer les albums au chargement de la page
    useEffect(() => {
        async function getCartes() {
            const reponse = await fetch(`${serveur}/albums`)
            if (reponse.ok) {
                const data = await reponse.json()
                setAllAlbums(data)
                setAlbums(data)
            }
        }

        getAlbums().then(() => { console.log("albums récupérés de l'API") })
    }, [])

    // useEffect pour récuperer les noms d'artistes de l'API
    useEffect(() => {
        async function getArtistes() {
            const reponse = await fetch(`${serveur}/artistes`)
            if (reponse.ok) {
                const data = await reponse.json()
                setAllArtistes(data)
            }
        }

        getArtistes().then(() => { console.log("artistes récupérés de l'API") })
    }, [])

    // useEffect pour filtrer les albums, change lorsque le nom d'artiste est changé ou lorsque un nom d'album est recherché
    useEffect(() => {
        function filtrerAlbums() {
            // si pas encore loadé, return pour ne pas faire crash
            if (albums == null) return

            let resultats = albums
            // reset les filtres
            setAlbums(albums)
            // cherche tous les albums qui ont le nom de l'artiste choisi
            if (nomArtiste != "") {
                resultats = resultats.filter((a) => a.artiste.nom == nomArtiste)
            }
            // ajoute tous les albums qui contiennent le contenu de la barre de recherche
            if (nomAlbum != "") {
                // change les albums filtrés en prennant la liste déjà filtrée 
                // filtre en comparant si les titres (en lower case) comprennent le contenu de la barre de recherche (en lower case)
                resultats = resultats.filter((a) => a.titre.toLowerCase().includes(nomAlbum.toLowerCase()))
            }
            setAlbums(resultats)
        }

        filtrerAlbums()
    }, [nomArtiste, nomAlbum])
    return (
        <>
            <div className="container">
                <div className="section">
                    <div className="columns">
                        <div className="column has-text-centered">
                            <h1 className="title">Collection</h1><br />
                        </div>
                    </div>
                    <div className="columns">
                        <div className="field is-horizontal">
                            <div className="field-label is-normal">
                                <label className="label">Titre</label>
                            </div>
                            <div className="field-body">
                                <div className="field">
                                    <p className="control is-expanded">
                                        <input className="input" type="text" placeholder="Titre de l'album" onChange={(e) => setNomAlbum(e.target.value)} />
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="field is-horizontal" style={{ paddingLeft: "20px" }}>
                            <div className="field-label is-normal">
                                <label className="label">Artiste</label>
                            </div>
                            <div className="field-body">
                                <div className="field">
                                    <div className="control" style={{ minWidth: "200px" }}>
                                        <div className="select is-fullwidth">
                                            {artistes != null &&
                                                <select onChange={(e) => setArtiste(e.target.value)}>
                                                    <option></option>
                                                    {artistes.map((a) => {
                                                        return <option key={a.artisteId}>{a.nom}</option>
                                                    })}
                                                </select>
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {albumsFiltres != null &&
                        <div className="row columns is-multiline">
                            {albumsFiltres.map((a) => {
                                return (
                                    <>
                                        <div className="column is-3">
                                            <div className="card large">
                                                <div className="card-image">
                                                    <figure className="image is-square">
                                                        <img src={a.coverUrl} alt={`Image de l'album ${a.titre}`} />
                                                    </figure>
                                                </div>
                                                <div className="card-content">
                                                    <div className="media">
                                                        <div className="media-content">
                                                            <p className="title is-4 no-padding">{a.titre}</p>
                                                            <p className="subtitle is-6">{a.artiste.nom}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )
                            })}
                        </div>
                    }
                </div>
            </div>
            <footer className="footer">
                <div className="container">
                    <div className="content has-text-centered">
                        <p>e6226989</p>
                    </div>
                </div>
            </footer>
        </>
    )
}

export default Collection