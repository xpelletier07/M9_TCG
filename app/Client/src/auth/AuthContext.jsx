import { createContext, useContext, useState } from 'react'

// Contexte global (React Context API) exposant l'état d'authentification à toute l'app
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // L'état initial est lu depuis localStorage pour rester connecté après un refresh de page
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  // Appelé après un login/signup réussi : sauvegarde le token/user en localStorage et met à jour le state React
  function login(user, token) {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setToken(token)
    setUser(user)
  }

  // Vide le localStorage et le state ; redirige ensuite vers /login (voir AppLayout.jsx)
  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return (
    // Fournit { user, token, login, logout } à tous les descendants via useAuth()
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook pratique pour accéder à { user, token, login, logout } depuis n'importe quel composant
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider")
  }
  return context
}
