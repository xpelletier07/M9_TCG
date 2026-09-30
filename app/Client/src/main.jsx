import React from 'react'
import { createRoot } from 'react-dom/client'
import Routeur from './Routeur.jsx'
import './css/index.css'
import "bulma/css/bulma.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css"

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Routeur />
  </React.StrictMode>
);