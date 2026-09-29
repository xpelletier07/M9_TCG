import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'
import Login from './pages/auth/Login.js'
import Signup from './pages/auth/Signup.js'
import Dashboard from './pages/Dashboard.js'
import Collection from './pages/Collection.jsx'
import Bazaar from './pages/Bazaar.js'
import Inventaire from './pages/Inventaire.jsx'
import Combat from './pages/Combat.jsx'

function Routeur() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                        <Route index element={<Dashboard />} />
                        <Route path="collection" element={<Collection />} />
                        <Route path="bazaar" element={<Bazaar />} />
                        <Route path="inventaire" element={<Inventaire />} />
                        <Route path="combat" element={<Combat />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default Routeur