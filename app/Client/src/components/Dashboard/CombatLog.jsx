import { useEffect, useState } from "react"
import { useAuth } from '../../auth/AuthContext'
import { API_BASE_URL } from '../../config'

export default function CombatLog(){
  const { token } = useAuth()
  const [combats, setCombats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(()=>{
    if (!token) {
      setCombats([])
      setLoading(false)
      return
    }
    const controller = new AbortController()

    async function chargementHistorique() {
      setLoading(true)
      setError('')
      

      try {
        const response = await fetch(`${API_BASE_URL}/combat/history`, {
          headers : {
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal,
        })

        if (!response.ok){
          throw new Error("impossible d'avoir l'historique de combats")
        }
        const data = await response.json()
        setCombats(data)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message)
        }
        
      }
      finally{
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    chargementHistorique()

    return () => controller.abort()
  },[token])
  return (
    <section className="dashboard-panel dashboard-combat">
      <div className="dashboard-combat-header">
        <div><span className="dashboard-kicker">VOS BATAILLES</span><h2 className="dashboard-combat-title">Historique de combats</h2></div>
        <span className="dashboard-status">20 derniers combats</span>
      </div>
      {loading ? (
        <div className="combat-log-message" role="status">
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          <p>Chargement de tes batailles...</p>
        </div>
      ) : error ? (
        <div className="combat-log-message combat-log-error" role="alert">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : combats.length === 0 ? (
        <div className="combat-log-message">
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          <h3>Ton histoire commence dans l’arène</h3>
          <p>Tes victoires et tes défis apparaîtront ici après ton premier combat.</p>
        </div>
      ) : (
        <>
          <div className="combat-log-summary">
            <span><strong>{combats.length}</strong> combats récents</span>
            <span><i className="fa-solid fa-trophy" aria-hidden="true" /> <strong>{combats.filter((combat) => combat.resultat === 'Victoire').length}</strong> victoires</span>
          </div>
          <ul className="combat-log-list">
            {combats.map((combat) => {
              const victory = combat.resultat === 'Victoire'
              const date = new Date(combat.date_combat)

              return (
                <li className={`combat-log-row ${victory ? 'combat-log-victory' : 'combat-log-defeat'}`} key={combat.id_combat}>
                  <span className="combat-log-icon" aria-hidden="true">
                    <i className={`fa-solid ${victory ? 'fa-trophy' : 'fa-shield-halved'}`} />
                  </span>
                  <div className="combat-log-opponent">
                    <span className="combat-log-label">ADVERSAIRE</span>
                    <strong>{combat.adversaire}</strong>
                  </div>
                  <span className="combat-log-result">{combat.resultat}</span>
                  <time className="combat-log-date" dateTime={combat.date_combat}>
                    <span>{date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>{date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</span>
                  </time>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
