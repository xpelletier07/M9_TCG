import { CAPACITES_INFO, NIVEAU_MAX, NIVEAU_MIN, libelleCapacite } from '../capacites.js'

// Affichage des capacités en lecture (modale de carte) ; `capacites` vient de lireCapacites
export function CapacitesListe({ capacites }) {
    if (capacites.length === 0) return null
    return (
        <div className="capacites-liste mb-5">
            <strong>Capacités :</strong>
            {capacites.map((capacite) => (
                <p key={capacite.id}>
                    {capacite.icone} <strong>{libelleCapacite(capacite)}</strong> : {capacite.texte}
                </p>
            ))}
        </div>
    )
}

// Choix des capacités du catalogue et de leur niveau (admin, cartes légendaires).
// `capacites` est l'objet { id: true | niveau } envoyé à l'API.
export function CapacitesEditor({ capacites, onChange }) {
    function basculer(id, gradue) {
        const { [id]: actuelle, ...autres } = capacites
        onChange(actuelle === undefined ? { ...capacites, [id]: gradue ? NIVEAU_MIN : true } : autres)
    }

    function changerNiveau(id, niveau) {
        onChange({ ...capacites, [id]: Number(niveau) })
    }

    return (
        <fieldset className="box capacites-editor">
            <legend className="label">Capacités</legend>
            {Object.entries(CAPACITES_INFO).map(([id, info]) => {
                const active = capacites[id] !== undefined
                return (
                    <div key={id} className="field is-grouped is-align-items-center mb-2">
                        <label className="checkbox control is-expanded" title={info.description('X')}>
                            <input type="checkbox" checked={active} onChange={() => basculer(id, info.gradue)} />{' '}
                            {info.icone} {info.nom}
                        </label>
                        {info.gradue && active && (
                            <div className="control">
                                <input className="input is-small" type="number" aria-label={`Niveau de ${info.nom}`}
                                    style={{ width: '4.5rem' }} min={NIVEAU_MIN} max={NIVEAU_MAX} step={1}
                                    value={capacites[id]} onChange={(event) => changerNiveau(id, event.target.value)} />
                            </div>
                        )}
                    </div>
                )
            })}
        </fieldset>
    )
}
