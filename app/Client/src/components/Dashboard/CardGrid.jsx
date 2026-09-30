import React from 'react'

export default function CardGrid() {
  return (
    <div className="box">
      <h2 className="subtitle">Cartes débloquées</h2>
      {/* Pour l'instant, ne rien afficher dedans */}
      <div className="content">
        <p>Vous n'avez encore débloqué aucune carte visible ici.</p>
        <div className="columns is-multiline">
          {/* Grid vide pour l'instant */}
        </div>
      </div>
    </div>
  )
}
