import { useAuth } from '../auth/AuthContext'

function Dashboard() {
    const { user } = useAuth()

    return (
        <h1>{`Bienvenue${user ? `, ${user.nom_utilisateur}` : ''}`}</h1>
    )
}

export default Dashboard
