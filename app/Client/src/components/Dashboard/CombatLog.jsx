import React from 'react'

export default function CombatLog(){
  return (
    <section className="bg-surface-container-lowest p-lg">
      <div className="flex justify-between items-center mb-md pb-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface font-bold uppercase">Historique de combats</h2>
        <button className="font-label-md text-label-md text-tertiary-container uppercase hover:underline">View All</button>
      </div>

      <div className="space-y-sm">
        <div>il y a rien pour l'instant</div>
      </div>
    </section>
  )
}
