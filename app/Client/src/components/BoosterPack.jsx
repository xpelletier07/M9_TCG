import React from 'react'
import dropImg from '../images.jpg'

export default function BoosterPack(){
  return (
    <section className="lg:col-span-4 bg-surface-container-lowest p-lg flex flex-col items-center text-center justify-center relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-sm">
        <span className="bg-tertiary-container text-on-tertiary font-label-sm text-label-sm px-sm py-xs uppercase">New Series</span>
      </div>
      <div className="w-40 h-56 bg-surface-container mb-lg mt-md transform transition-transform group-hover:scale-105 duration-300 tcg-border-active shadow-lg relative">
        <img alt="Booster Pack" className="w-full h-full object-cover" src={dropImg}/>
      </div>
      <h3 className="font-headline-md text-headline-md text-on-surface font-bold uppercase mb-xs">Set not found yet</h3>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">Could not find a matching set for this booster pack.</p>
      <button className="open-pack-btn w-full">
        <span>Open Pack</span>
        <span className="material-symbols-outlined">unarchive</span>
      </button>
      <div className="font-label-sm text-label-sm text-on-surface-variant mt-sm">Inventory: none</div>
    </section>
  )
}
