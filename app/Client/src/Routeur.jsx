import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'
import Login from './rename/auth/Login.jsx'
import Signup from './rename/auth/Signup.jsx'
import Dashboard from './rename/Dashboard.js'
import Collection from './rename/Collection.js'
import Bazaar from './rename/Bazaar.js'
import Inventaire from './rename/Inventaire.jsx'
import Combat from './rename/Combat.jsx'

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