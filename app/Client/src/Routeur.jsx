import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./auth/AuthContext"
import ProtectedRoute from "./auth/ProtectedRoute"
import App from "./App"
import Login from "./pages/auth/Login"
import Signup from "./pages/auth/Signup"
import Dashboard from "./pages/Dashboard"
import Collection from "./pages/Collection"

// Placeholder pour les pages pas encore développées
const placeholder = (label) => <div className="section has-text-centered">{label} — Bientôt disponible</div>

function Routeur() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>}>
                        <Route index element={<Dashboard />} />
                        <Route path="catalogue" element={placeholder("Catalogue")} />
                        <Route path="bazaar" element={placeholder("Bazaar")} />
                        <Route path="inventaire" element={placeholder("Inventaire")} />
                        <Route path="combat" element={placeholder("Combat")} />
                        <Route path="collection" element={<Collection />} />
                    </Route>
                    {/* 
                        Insérer vos pages ici, au dessus du Route path="*"
                    */}
                    <Route path="*" element={
                        <div className="section has-text-centered">Page non trouvée</div>
                    }
                    />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default Routeur