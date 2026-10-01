import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './css/index.css'
import Routeur from "./Routeur.jsx"
import { AuthProvider } from './auth/AuthContext'
import "bulma/css/bulma.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Routeur />
    </AuthProvider>
  </StrictMode>,
)
