import { useEffect, useState } from "react"

const raretes = {
    1: "Commun",
    2: "Rare",
    3: "Épique",
    4: "Légendaire",
}

export function CardModal({ isOpen, carte, isAdmin, token, onClose, onUpdated, onDeleted }) {
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState(null);
    const [erreur, setErreur] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!carte) return;

        setForm({
            nomCarte: carte.nom_carte,
            image: carte.image,
            description: carte.description ?? "",
            rarete: carte.rarete,
            valeur: carte.valeur,
            mana: carte.mana,
            health: carte.health,
            damage: carte.damage,
        });

        setIsEditing(false);
        setErreur("");
    }, [carte]);

    // fonction générique pour modifier un champ, est utilisé pour modifier chaque champ lorsque l'utilisateur est admin
    function modifierChamp(event) {
        const { name, value } = event.target;

        setForm((formActuel) => ({
            ...formActuel,
            [name]: value,
        }));
    }

    // fonction pour faire caller la route PATCH en backend lorsqu'on souhaite modifier les infos de la carte
    async function enregistrerModification() {
        setIsSubmitting(true);
        setErreur("");
        try {
            const reponse = await fetch(`http://localhost:3000/collection/${carte.id_carte}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...form,
                    // besoin de mettre des Number(), sinon prends des string et essaye de les envoyer dans la bd qui eux sont en int
                    rarete: Number(form.rarete),
                    valeur: Number(form.valeur),
                    mana: Number(form.mana),
                    health: Number(form.health),
                    damage: Number(form.damage),
                }),
            }
            )
            // si erreur
            if (!reponse.ok) {
                const resultat = await reponse.json();
                throw new Error(
                    resultat.message ??
                    resultat.error ??
                    "Impossible de modifier la carte"
                );
            }
            // sinon update côté client, et enleve le mode d'édition => retour au mode d'affichage normal
            const carteModifiee = await reponse.json();
            onUpdated(carteModifiee);
            setIsEditing(false);
        } catch (error) {
            setErreur(error.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    // fonction pour faire un appel au serveur pour deleter la carte choisie
    async function supprimerCarte() {
        const confirmation = window.confirm(`Supprimer définitivement la carte " ${carte.nom_carte} " ?`);
        // si on confirme pas, sort tout de suite
        if (!confirmation) return;
        setIsSubmitting(true);
        setErreur("");
        try {
            const reponse = await fetch(`http://localhost:3000/collection/${carte.id_carte}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!reponse.ok) {
                const resultat = await reponse.json();
                throw new Error(
                    resultat.message ??
                    resultat.error ??
                    "Impossible de supprimer la carte"
                );
            }
            onDeleted(carte.id_carte);
        } catch (error) {
            setErreur(error.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    function annulerModification() {
        setForm({
            nomCarte: carte.nom_carte,
            image: carte.image,
            description: carte.description ?? "",
            rarete: carte.rarete,
            valeur: carte.valeur,
            mana: carte.mana,
            health: carte.health,
            damage: carte.damage,
        });
        setErreur("");
        setIsEditing(false);
    }

    if (!isOpen || !carte || !form) return null

    return (
        <div className="modal is-active" role="dialog" aria-modal="true" aria-labelledby="card-modal-title">
            <div className="modal-background" onClick={onClose} />
            <div className="modal-card">
                <header className="modal-card-head">
                    {isEditing ? (
                        <input
                            id="card-modal-title"
                            className="input"
                            type="text"
                            name="nomCarte"
                            value={form.nomCarte}
                            onChange={modifierChamp}
                        />
                    ) : (
                        <p id="card-modal-title" className="modal-card-title">{carte.nom_carte}</p>
                    )}
                    <button type="button" className="delete" aria-label="Fermer" onClick={onClose} />
                </header>
                <section className="modal-card-body">
                    {isEditing && (
                        <div className="field">
                            <label className="label" htmlFor="card-image">URL de l'image</label>
                            <div className="control">
                                <input
                                    id="card-image"
                                    className="input"
                                    type="text"
                                    name="image"
                                    value={form.image}
                                    onChange={modifierChamp}
                                />
                            </div>
                        </div>
                    )}
                    <figure className="image mb-5">
                        <img
                            src={isEditing ? form.image : carte.image}
                            alt={`Image de la carte ${isEditing ? form.nomCarte : carte.nom_carte}`}
                        />
                    </figure>
                    {isEditing ? (
                        <div className="field">
                            <label className="label" htmlFor="card-description">Description</label>
                            <div className="control">
                                <textarea
                                    id="card-description"
                                    className="textarea"
                                    name="description"
                                    value={form.description}
                                    onChange={modifierChamp}
                                />
                            </div>
                        </div>
                    ) : (
                        carte.description && <p className="mb-5">{carte.description}</p>
                    )}
                    <div className="columns is-multiline">
                        <div className="column is-half">
                            <strong>Rareté :</strong>{" "}
                            {isEditing ? (
                                <div className="select is-fullwidth">
                                    <select name="rarete" value={form.rarete} onChange={modifierChamp}>
                                        <option value={1}>Commun</option>
                                        <option value={2}>Rare</option>
                                        <option value={3}>Épique</option>
                                        <option value={4}>Légendaire</option>
                                    </select>
                                </div>
                            ) : (
                                raretes[carte.rarete] ?? carte.rarete
                            )}
                        </div>
                        <div className="column is-half">
                            <strong>Mana :</strong>{" "}
                            {isEditing ? (
                                <input className="input" type="number" name="mana" value={form.mana} onChange={modifierChamp} />
                            ) : carte.mana}
                        </div>
                        <div className="column is-half">
                            <strong>Attaque :</strong>{" "}
                            {isEditing ? (
                                <input className="input" type="number" name="damage" value={form.damage} onChange={modifierChamp} />
                            ) : carte.damage}
                        </div>
                        <div className="column is-half">
                            <strong>Vie :</strong>{" "}
                            {isEditing ? (
                                <input className="input" type="number" name="health" value={form.health} onChange={modifierChamp} />
                            ) : carte.health}
                        </div>
                        <div className="column is-half">
                            <strong>Valeur :</strong>{" "}
                            {isEditing ? (
                                <input className="input" type="number" name="valeur" value={form.valeur} onChange={modifierChamp} />
                            ) : carte.valeur}
                        </div>
                    </div>
                </section>
                {erreur && (
                    <div className="notification is-danger">
                        {erreur}
                    </div>
                )}
                <footer className="modal-card-foot">
                    {!isEditing && (
                        <button type="button" className="button" onClick={onClose}>Fermer</button>
                    )}
                    {/* si on est admin et PAS en mode d'édition, les bouttons sont pour entrer dans le mode édition ou pour delete */}
                    {isAdmin && !isEditing && (
                        <>
                            <button type="button" className="button is-warning" style={{'margin-left': '0.5em'}} onClick={() => setIsEditing(true)}>Modifier</button>
                            <button type="button" className="button is-danger" style={{'margin-left': '0.5em'}} onClick={supprimerCarte} disabled={isSubmitting}>Supprimer</button>
                        </>
                    )}
                    {/* si on est admin et EN mode d'édition, bouttons sont pour enregistrer ou annuler */}
                    {isAdmin && isEditing && (
                        <>
                            <button type="button" className={`button is-primary ${isSubmitting ? "is-loading" : ""}`} style={{'margin-left': '0.5em'}}
                                onClick={enregistrerModification} disabled={isSubmitting}>
                                Enregistrer
                            </button>
                            <button type="button" className="button" style={{'margin-left': '0.5em'}} onClick={annulerModification} disabled={isSubmitting}>Annuler</button>
                        </>
                    )}
                </footer>
            </div>
        </div>
    )
}