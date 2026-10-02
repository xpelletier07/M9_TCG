import React from 'react'
import DropSection from '../components/Dashboard/DropSection'
import BoosterPack from '../components/Dashboard/BoosterPack'
import CombatLog from '../components/Dashboard/CombatLog'
import '../css/Dashboard.css'

export default function MainContent(){
  return (

    <main className="content-left-spacing">
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
        <CombatLog />
      </div>
    </main>
  )
}
