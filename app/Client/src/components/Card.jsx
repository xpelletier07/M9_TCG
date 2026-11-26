import '../css/InventoryCards.css'

const PLACEHOLDER_IMAGE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23080f1c'/%3E%3Crect x='1' y='1' width='198' height='198' fill='none' stroke='%23243450' stroke-width='1'/%3E%3Ccircle cx='100' cy='82' r='28' fill='none' stroke='%23243450' stroke-width='2'/%3E%3Ccircle cx='100' cy='78' r='14' fill='%23172030'/%3E%3Ccircle cx='100' cy='74' r='5' fill='%23243450'/%3E%3Cpath d='M72 118 Q100 98 128 118' fill='none' stroke='%23243450' stroke-width='2'/%3E%3Cpath d='M60 130 Q100 108 140 130' fill='none' stroke='%23172030' stroke-width='1' stroke-dasharray='4 3'/%3E%3Ctext x='100' y='160' font-family='monospace' font-size='10' fill='%23364d6a' text-anchor='middle' letter-spacing='2'%3EIMAGE%3C/text%3E%3Ctext x='100' y='174' font-family='monospace' font-size='8' fill='%23243450' text-anchor='middle'%3Enon définie%3C/text%3E%3C/svg%3E`

const rareteLabels = {
    1: 'Commun',
    2: 'Rare',
    3: 'Épique',
    4: 'Légendaire',
}

export default function Card({ carte, onClick, quantite = 1 }) {
    const quantiteNum = Number(quantite) || 1
    const libelleQuantite = `${quantiteNum} exemplaire${quantiteNum > 1 ? 's' : ''}`

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
                <div className="inventory-card__metadata">
                    {quantiteNum > 1 && (
                        <span
                            className="inventory-card__quantity"
                            title={libelleQuantite}
                            aria-label={libelleQuantite}
                        >
                            <span className="inventory-card__quantity-prefix">x</span>
                            <span className="inventory-card__quantity-value">{quantiteNum}</span>
                        </span>
                    )}
                    <span className="inventory-card__serial">
                        ID {String(carte.id_carte).padStart(3, '0')}
                    </span>
                </div>
            </div>
            <div className="inventory-card__image-frame">
                <img
                    src={carte.image || PLACEHOLDER_IMAGE}
                    alt={carte.image ? `Image de la carte ${carte.nom_carte}` : 'Aucune image'}
                    className={`inventory-card__image${!carte.image ? ' inventory-card__image--placeholder' : ''}`}
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE }}
                />
            </div>
            <div className="inventory-card__content">
                <h3 className="inventory-card__name">{carte.nom_carte}</h3>
                {carte.description && (
                    <p className="inventory-card__description">{carte.description}</p>
                )}
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
