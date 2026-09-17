import React from 'react'
import dropImg from '../images.jpg'

export default function DropSection(){
  return (
    <section className="lg:col-span-8 bg-surface-container-lowest p-lg flex flex-col justify-between">
      <div className="flex justify-between items-start mb-lg">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold uppercase">Drop Commun</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Global Server Supply Drop Event</p>
        </div>
        <div className="timer-badge">
          <span className="material-symbols-outlined">timer</span>
          <span className="font-mono">--:--:--</span>
        </div>
      </div>
      <div className="relative h-48 bg-surface-container overflow-hidden flex items-center justify-center">
        <img alt="Supply Drop Crate" className="absolute inset-0 w-full h-full object-cover opacity-80" src={dropImg} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div className="relative z-10 text-center">
          <div className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-primary font-black uppercase tracking-widest drop-shadow-md">M9 cache</div>
          <div className="font-label-md text-label-md text-on-primary/90 uppercase tracking-widest mt-xs">tier not found</div>
        </div>
      </div>
    </section>
  )
}
