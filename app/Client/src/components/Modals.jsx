import { useEffect, useState } from "react"

import { API_BASE_URL } from "../config"
import '../css/InventoryCards.css'

const raretes = {
    1: "Commun",
    2: "Rare",
    3: "Épique",
    4: "Légendaire",
}

// SVG placeholder encodé en data URI — utilisé quand l'image est vide
const PLACEHOLDER_IMAGE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23080f1c'/%3E%3Crect x='1' y='1' width='198' height='198' fill='none' stroke='%23243450' stroke-width='1'/%3E%3Ccircle cx='100' cy='82' r='28' fill='none' stroke='%23243450' stroke-width='2'/%3E%3Ccircle cx='100' cy='78' r='14' fill='%23172030'/%3E%3Ccircle cx='100' cy='74' r='5' fill='%23243450'/%3E%3Cpath d='M72 118 Q100 98 128 118' fill='none' stroke='%23243450' stroke-width='2'/%3E%3Cpath d='M60 130 Q100 108 140 130' fill='none' stroke='%23172030' stroke-width='1' stroke-dasharray='4 3'/%3E%3Ctext x='100' y='160' font-family='monospace' font-size='10' fill='%23364d6a' text-anchor='middle' letter-spacing='2'%3EIMAGE%3C/text%3E%3Ctext x='100' y='174' font-family='monospace' font-size='8' fill='%23243450' text-anchor='middle'%3Enon définie%3C/text%3E%3C/svg%3E`

const rareteColors = {
    1: { accent: '#b8c0cc', rgb: '184, 192, 204' },
    2: { accent: '#70b9ff', rgb: '112, 185, 255' },
    3: { accent: '#c59aff', rgb: '197, 154, 255' },
    4: { accent: '#ffd176', rgb: '255, 209, 118' },
}

export function CardModal({ carte, isNew, isAdmin, token, onClose, onUpdated, onDeleted }) {
    const [isEditing, setIsEditing] = useState(isNew);
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

        setIsEditing(isNew);
        setErreur("");
    }, [carte, isNew]);

    function modifierChamp(event) {
        const { name, value } = event.target;
        setForm((formActuel) => ({ ...formActuel, [name]: value }));
    }

    async function enregistrerModification() {
        setIsSubmitting(true);
        setErreur("");
        try {
            let reponse;
            if (isNew === false) {
                reponse = await fetch(`${API_BASE_URL}/collection/${carte.id_carte}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        ...form,
                        rarete: Number(form.rarete), valeur: Number(form.valeur),
                        mana: Number(form.mana), health: Number(form.health), damage: Number(form.damage),
                    }),
                })
            } else if (isNew === true) {
                reponse = await fetch(`${API_BASE_URL}/collection/card`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        ...form,
                        rarete: Number(form.rarete), valeur: Number(form.valeur),
                        mana: Number(form.mana), health: Number(form.health), damage: Number(form.damage),
                    }),
                })
            }
            if (!reponse.ok) {
                const resultat = await reponse.json();
                throw new Error(resultat.message ?? resultat.error ?? "Impossible de modifier ou ajouter la carte");
            }
            const carteModifiee = await reponse.json();
            onUpdated(carteModifiee);
            setIsEditing(false);
        } catch (error) {
            setErreur(error.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function supprimerCarte() {
        const confirmation = window.confirm(`Supprimer définitivement la carte " ${carte.nom_carte} " ?`);
        if (!confirmation) return;
        setIsSubmitting(true);
        setErreur("");
        try {
            const reponse = await fetch(`${API_BASE_URL}/collection/${carte.id_carte}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!reponse.ok) {
                const resultat = await reponse.json();
                throw new Error(resultat.message ?? resultat.error ?? "Impossible de supprimer la carte");
            }
            onDeleted(carte.id_carte);
        } catch (error) {
            setErreur(error.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    function annulerModification() {
        if (isNew) { onClose(); return; }
        setForm({
            nomCarte: carte.nom_carte, image: carte.image,
            description: carte.description ?? "", rarete: carte.rarete,
            valeur: carte.valeur, mana: carte.mana, health: carte.health, damage: carte.damage,
        });
        setErreur("");
        setIsEditing(false);
    }

    if (!carte || !form) return null

    const rareteKey = isEditing ? Number(form.rarete) : carte.rarete
    const color = rareteColors[rareteKey] ?? rareteColors[1]

    return (
        <div className="modal is-active card-detail-modal" role="dialog" aria-modal="true" aria-labelledby="card-modal-title">
            <div className="modal-background" onClick={onClose} />
            <div
                className="card-detail-panel"
                style={{ '--card-accent': color.accent, '--card-accent-rgb': color.rgb }}
            >
                {/* Bouton fermer */}
                <button type="button" className="card-detail-close" aria-label="Fermer" onClick={onClose}>✕</button>

                {/* Partie gauche : visuel de la carte */}
                <div className="card-detail-visual">
                    <div className={`card-detail-preview inventory-card--rarity-${rareteKey}`}>
                        <div className="card-detail-preview__eyebrow">
                            <span className="inventory-card__rank">
                                {raretes[rareteKey] ?? 'Carte'}
                            </span>
                            {carte.id_carte && (
                                <span className="inventory-card__serial">
                                    ID {String(carte.id_carte).padStart(3, '0')}
                                </span>
                            )}
                        </div>
                        <div className="card-detail-preview__image-frame">
                            {(isEditing ? form.image : carte.image) ? (
                                <img
                                    src={isEditing ? form.image : carte.image}
                                    alt={`Image de la carte ${isEditing ? form.nomCarte : carte.nom_carte}`}
                                    className="inventory-card__image"
                                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE }}
                                />
                            ) : (
                                <img
                                    src={PLACEHOLDER_IMAGE}
                                    alt="Aucune image"
                                    className="inventory-card__image card-detail-preview__image--placeholder"
                                />
                            )}
                        </div>
                        <div className="card-detail-preview__footer">
                            <h2 className="inventory-card__name">{isEditing ? form.nomCarte : carte.nom_carte}</h2>
                            {(isEditing ? form.description : carte.description) && (
                                <p className="inventory-card__description">
                                    {isEditing ? form.description : carte.description}
                                </p>
                            )}
                            <div className="inventory-card__stats">
                                <span className="inventory-card__stat inventory-card__stat--mana" title="Mana">
                                    <span>Mana</span><strong>{isEditing ? form.mana : carte.mana}</strong>
                                </span>
                                <span className="inventory-card__stat inventory-card__stat--health" title="Vie">
                                    <span>Vie</span><strong>{isEditing ? form.health : carte.health}</strong>
                                </span>
                                <span className="inventory-card__stat inventory-card__stat--damage" title="Dégâts">
                                    <span>ATQ</span><strong>{isEditing ? form.damage : carte.damage}</strong>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Partie droite : infos / formulaire */}
                <div className="card-detail-info">
                    <div className="card-detail-info__header">
                        {isEditing ? (
                            <div className="field mb-2">
                                <label className="card-detail-label">Nom de la carte</label>
                                <input className="input card-detail-input" type="text" name="nomCarte" value={form.nomCarte} onChange={modifierChamp} />
                            </div>
                        ) : (
                            <h1 id="card-modal-title" className="card-detail-title">{carte.nom_carte}</h1>
                        )}
                        <div className={`card-detail-rarity-badge inventory-card--rarity-${rareteKey}`}>
                            {raretes[rareteKey] ?? carte.rarete}
                        </div>
                    </div>

                    {/* Description */}
                    {isEditing ? (
                        <div className="field mb-4">
                            <label className="card-detail-label">Description</label>
                            <textarea className="textarea card-detail-textarea" name="description" value={form.description} onChange={modifierChamp} rows={3} />
                        </div>
                    ) : (
                        carte.description && (
                            <p className="card-detail-description">{carte.description}</p>
                        )
                    )}

                    {/* Stats */}
                    <div className="card-detail-stats-grid">
                        {/* Rareté */}
                        {isEditing ? (
                            <div className="card-detail-stat-row">
                                <span className="card-detail-stat-label">Rareté</span>
                                <div className="select is-small">
                                    <select name="rarete" value={form.rarete} onChange={modifierChamp} className="card-detail-select">
                                        <option value={1}>Commun</option>
                                        <option value={2}>Rare</option>
                                        <option value={3}>Épique</option>
                                        <option value={4}>Légendaire</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="card-detail-stat-row">
                                <span className="card-detail-stat-label">Rareté</span>
                                <span className="card-detail-stat-value">{raretes[carte.rarete] ?? carte.rarete}</span>
                            </div>
                        )}

                        {/* Mana */}
                        <div className="card-detail-stat-row card-detail-stat-row--mana">
                            <span className="card-detail-stat-label">💧 Mana</span>
                            {isEditing
                                ? <input className="input is-small card-detail-input" type="number" name="mana" min="0" max="10" value={form.mana} onChange={modifierChamp} />
                                : <span className="card-detail-stat-value card-detail-stat-value--mana">{carte.mana}</span>
                            }
                        </div>

                        {/* Vie */}
                        <div className="card-detail-stat-row card-detail-stat-row--health">
                            <span className="card-detail-stat-label">❤️ Vie</span>
                            {isEditing
                                ? <input className="input is-small card-detail-input" type="number" name="health" min="1" max="1000" value={form.health} onChange={modifierChamp} />
                                : <span className="card-detail-stat-value card-detail-stat-value--health">{carte.health}</span>
                            }
                        </div>

                        {/* Attaque */}
                        <div className="card-detail-stat-row card-detail-stat-row--damage">
                            <span className="card-detail-stat-label">⚔️ Attaque</span>
                            {isEditing
                                ? <input className="input is-small card-detail-input" type="number" name="damage" min="0" max="1000" value={form.damage} onChange={modifierChamp} />
                                : <span className="card-detail-stat-value card-detail-stat-value--damage">{carte.damage}</span>
                            }
                        </div>

                        {/* Valeur */}
                        <div className="card-detail-stat-row">
                            <span className="card-detail-stat-label">🪙 Valeur</span>
                            {isEditing
                                ? <input className="input is-small card-detail-input" type="number" name="valeur" min="1" max="1000" value={form.valeur} onChange={modifierChamp} />
                                : <span className="card-detail-stat-value">{carte.valeur}</span>
                            }
                        </div>
                    </div>

                    {/* URL image (édition) */}
                    {isEditing && (
                        <div className="field mt-3">
                            <label className="card-detail-label">URL de l'image</label>
                            <input className="input card-detail-input" type="text" name="image" value={form.image} onChange={modifierChamp} />
                        </div>
                    )}

                    {/* Erreur */}
                    {erreur && (
                        <div className="notification is-danger is-light mt-3" style={{ padding: '0.65rem 1rem' }}>
                            {erreur}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="card-detail-actions">
                        {!isEditing && (
                            <button type="button" className="card-detail-btn card-detail-btn--close" onClick={onClose}>
                                Fermer
                            </button>
                        )}
                        {isAdmin && !isEditing && (
                            <>
                                <button type="button" className="card-detail-btn card-detail-btn--edit" onClick={() => setIsEditing(true)}>
                                    ✏️ Modifier
                                </button>
                                <button type="button" className="card-detail-btn card-detail-btn--delete" onClick={supprimerCarte} disabled={isSubmitting}>
                                    🗑 Supprimer
                                </button>
                            </>
                        )}
                        {isAdmin && isEditing && (
                            <>
                                <button
                                    type="button"
                                    className={`card-detail-btn card-detail-btn--save ${isSubmitting ? 'is-loading' : ''}`}
                                    onClick={enregistrerModification}
                                    disabled={isSubmitting}
                                >
                                    ✅ Enregistrer
                                </button>
                                <button type="button" className="card-detail-btn card-detail-btn--cancel" onClick={annulerModification} disabled={isSubmitting}>
                                    Annuler
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}