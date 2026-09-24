import React from 'react'
import DropSection from './DropSection'
import BoosterPack from './BoosterPack'
import CombatLog from './CombatLog'
import Sidebar from '../sidebar/Sidebar'

export default function MainContent(){
  return (

    <main className="flex-1 pt-16 p-margin-mobile md:p-margin-desktop bg-background min-h-screen">
      <div className="max-w-7xl mx-auto space-y-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-8">
            <div className="tcg-box">
              <DropSection />
            </div>
          </div>
          <div className="lg:col-span-4">
            <div className="tcg-box">
              <BoosterPack />
            </div>
          </div>
        </div>
        <div className="tcg-box">
          <CombatLog />
        </div>
      </div>
    </main>
  )
}
