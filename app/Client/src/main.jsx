import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PageTestMarco from './pagetest_marco.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PageTestMarco />
  </StrictMode>,
)
