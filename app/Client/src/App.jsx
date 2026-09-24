import React from 'react'
import TopAppBar from './components/TopAppBar'
import MainContent from './components/MainContent'
import Sidebar from './sidebar/Sidebar'

export default function App(){
  return (
    <div className="tcg-app-shell">
      <Sidebar />
      <div className="tcg-main-shell">
        <TopAppBar />
        <MainContent />
      </div>
    </div>
  )
}
