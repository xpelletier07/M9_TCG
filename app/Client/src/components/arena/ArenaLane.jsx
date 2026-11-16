// Terrain d'un joueur (max 7 créatures). Mon terrain est la zone de dépôt des cartes (data-drop="board").
function ArenaLane({ side, isDropActive = false, isEmpty, children }) {
  return (
    <div
      className={`arena-lane arena-lane--${side} ${isDropActive ? 'is-drop-active' : ''}`}
      data-drop={side === 'me' ? 'board' : undefined}
      data-side={side}
    >
      {isEmpty && (
        <span className="arena-lane-empty">
          {side === 'me' ? 'Glisse ou clique une carte pour la jouer' : 'Terrain adverse vide'}
        </span>
      )}
      {children}
    </div>
  )
}

export default ArenaLane
