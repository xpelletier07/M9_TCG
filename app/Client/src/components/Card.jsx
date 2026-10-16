import '../css/InventoryCards.css'

const rareteLabels = {
    1: 'Commun',
    2: 'Rare',
    3: 'Épique',
    4: 'Légendaire',
}

export default function Card({ carte, onClick }) {
    return (
        <div
            className={`inventory-card inventory-card--rarity-${carte.rarete}`}
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick()
                }
            }}
        >
            <div className="inventory-card__eyebrow">
                <span className="inventory-card__rank">
                    {rareteLabels[carte.rarete] ?? 'Carte'}
                </span>
                <span className="inventory-card__serial">
                    ID {String(carte.id_carte).padStart(3, '0')}
                </span>
            </div>
            <div className="inventory-card__image-frame">
                <img
                    src={carte.image}
                    alt={`Image de la carte ${carte.nom_carte}`}
                    className="inventory-card__image"
                />
            </div>
            <div className="inventory-card__content">
                <h3 className="inventory-card__name">{carte.nom_carte}</h3>
                <p className="inventory-card__description">{carte.description}</p>
                <div className="inventory-card__stats">
                    <span className="inventory-card__stat inventory-card__stat--mana" title="Mana">
                        <span>Mana</span><strong>{carte.mana}</strong>
                    </span>
                    <span className="inventory-card__stat inventory-card__stat--health" title="Vie">
                        <span>Vie</span><strong>{carte.health}</strong>
                    </span>
                    <span className="inventory-card__stat inventory-card__stat--damage" title="Dégâts">
                        <span>ATQ</span><strong>{carte.damage}</strong>
                    </span>
                </div>
            </div>
        </div>
    )
}
