const MAX_MANA = 10
const PLAYER_HP = 50

// Barre d'un joueur : avatar + PV, nom, compteurs et cristaux de mana.
// Côté adversaire, la barre est une cible d'attaque (data-target="player").
function PlayerBar({ player, name, side, active = false, targetable = false, effect = '', children, ...handlers }) {
  const hpPercent = Math.max(0, Math.min(100, (player.hp / PLAYER_HP) * 100))
  const meta = side === 'me'
    ? `${player.deckCount} cartes dans le deck`
    : `${player.handCount} en main · ${player.deckCount} dans le deck`

  return (
    <div
      className={`arena-player arena-player--${side} ${active ? 'is-active' : ''} ${targetable ? 'is-targetable' : ''} ${effect}`}
      data-target={side === 'opponent' ? 'player' : undefined}
      data-player-side={side}
      {...handlers}
    >
      <div className="arena-avatar" style={{ '--hp': `${hpPercent}%` }}>
        <span className="arena-avatar-initial">{(name ?? '?').charAt(0).toUpperCase()}</span>
        <span className={`arena-avatar-hp ${player.hp <= 10 ? 'is-low' : ''}`} title="Points de vie">{player.hp}</span>
      </div>
      <div className="arena-player-info">
        <span className="arena-player-name">{name}{side === 'me' && <em> (toi)</em>}</span>
        <span className="arena-player-meta">{meta}</span>
      </div>
      {children}
      <div className="arena-mana" title={`Mana ${player.mana}/${player.maxMana}`}>
        <span className="arena-mana-label">{player.mana}/{player.maxMana}</span>
        <div className="arena-mana-crystals">
          {Array.from({ length: MAX_MANA }, (_, i) => (
            <i
              key={i}
              className={i < player.mana ? 'is-full' : i < player.maxMana ? 'is-spent' : 'is-locked'}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default PlayerBar
