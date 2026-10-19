import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '../config'




function Combat() {
  const socketRef = useRef(null)
  const [connectionStatus, setConnectionStatus] = useState('Connexion...')
  const [matchStatus, setMatchStatus] = useState('Aucun combat rejoint')
  const [events, setEvents] = useState([])
  const [joinedMatchId, setJoinedMatchId] = useState(null)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])

  useEffect(() => {
    const socket = io(API_BASE_URL)
    socketRef.current = socket

    const addEvent = (message) => {
      setEvents((currentEvents) => [message, ...currentEvents].slice(0, 8))
    }

    socket.on('connect', () => setConnectionStatus('Connecté'))
    socket.on('disconnect', () => setConnectionStatus('Déconnecté'))
    socket.on('connect_error', () => setConnectionStatus('Serveur indisponible'))
    socket.on('combat:connected', () => addEvent('Socket de combat prête'))
    socket.on('combat:joined', ({ matchId }) => {
      setJoinedMatchId(matchId)
      setMatchStatus(`Combat rejoint : ${matchId}`)
      addEvent(`Vous avez rejoint ${matchId}`)
    })
    socket.on('combat:left', () => {
      setJoinedMatchId(null)
      setMatchStatus('Aucun combat rejoint')
      setMessages([])
      setMessage('')
      addEvent('Vous avez quitté le combat')
    })
    socket.on('combat:player-joined', ({ playerId }) => addEvent(`Joueur connecté : ${playerId}`))
    socket.on('combat:player-left', ({ playerId, reason }) => {
      addEvent(`${reason === 'left' ? 'Joueur parti' : 'Joueur déconnecté'} : ${playerId}`)
    })
    socket.on('combat:action', ({ action }) => addEvent(`Action reçue : ${action}`))
    socket.on('combat:message', ({ playerId, message: receivedMessage }) => {
      setMessages((currentMessages) => [
        { playerId, message: receivedMessage },
        ...currentMessages,
      ].slice(0, 30))
    })
    socket.on('combat:error', ({ message }) => addEvent(`Erreur : ${message}`))

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  function toggleCombat() {
    if (joinedMatchId) {
      socketRef.current?.emit('combat:leave')
      return
    }

    socketRef.current?.emit('combat:join', { matchId: 'lobby' })
  }

  function sendMessage(event) {
    event.preventDefault()
    const trimmedMessage = message.trim()
    if (!trimmedMessage || !joinedMatchId) return

    socketRef.current?.emit('combat:message', { message: trimmedMessage })
    setMessage('')
  }

  return (
    <main className="content-left-spacing">
      <h1>Combat</h1>
      <section className="feature-status" aria-live="polite">
        <span className="feature-status-label">Socket.IO</span>
        <p>Connexion : {connectionStatus}</p>
        <p>{matchStatus}</p>
        <button type="button" onClick={toggleCombat} disabled={connectionStatus !== 'Connecté'}>
          {joinedMatchId ? 'Quitter le combat' : 'Rejoindre le lobby'}
        </button>
        <form className="combat-chat-form" onSubmit={sendMessage}>
          <label htmlFor="combat-message">Message à la salle</label>
          <div>
            <input
              id="combat-message"
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Écrire un message..."
              maxLength={500}
              disabled={!joinedMatchId}
            />
            <button type="submit" disabled={!joinedMatchId || !message.trim()}>Envoyer</button>
          </div>
        </form>
        <ul className="combat-messages" aria-live="polite">
          {messages.map(({ playerId, message: receivedMessage }, index) => (
            <li key={`${playerId}-${index}`}><strong>{playerId}</strong> : {receivedMessage}</li>
          ))}
        </ul>
        <ul>
          {events.map((event, index) => <li key={`${event}-${index}`}>{event}</li>)}
        </ul>
      </section>
    </main>
  )
}

export default Combat
