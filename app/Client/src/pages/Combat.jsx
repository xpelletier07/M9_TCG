import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '../config'




function Combat() {
  const socketRef = useRef(null)
  const eventTimersRef = useRef(new Set())
  const [connectionStatus, setConnectionStatus] = useState('Connexion...')
  const [matchStatus, setMatchStatus] = useState('Aucun combat rejoint')
  const [events, setEvents] = useState([])
  const [joinedMatchId, setJoinedMatchId] = useState(null)
  const [socketId, setSocketId] = useState(null)
  const [players, setPlayers] = useState([])
  const [combatStarted, setCombatStarted] = useState(false)
  const [matchCode, setMatchCode] = useState('')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])

  useEffect(() => {
    const socket = io(API_BASE_URL)
    socketRef.current = socket

    const addEvent = (message) => {
      const eventId = `${Date.now()}-${Math.random()}`
      setEvents((currentEvents) => [{ id: eventId, message }, ...currentEvents].slice(0, 8))

      const timer = setTimeout(() => {
        setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId))
        eventTimersRef.current.delete(timer)
      }, 5000)
      eventTimersRef.current.add(timer)
    }

    socket.on('connect', () => setConnectionStatus('Connecté'))
    socket.on('disconnect', () => setConnectionStatus('Déconnecté'))
    socket.on('connect_error', () => setConnectionStatus('Serveur indisponible'))
    socket.on('combat:connected', ({ socketId: connectedSocketId }) => {
      setSocketId(connectedSocketId)
      addEvent('Socket de combat prête')
    })
    socket.on('combat:joined', ({ matchId }) => {
      setJoinedMatchId(matchId)
      setCombatStarted(false)
      setMatchStatus(`Combat rejoint : ${matchId}`)
      addEvent(`Vous avez rejoint ${matchId}`)
    })
    socket.on('combat:left', () => {
      setJoinedMatchId(null)
      setMatchStatus('Aucun combat rejoint')
      setPlayers([])
      setCombatStarted(false)
      setMessages([])
      setMessage('')
      addEvent('Vous avez quitté le combat')
    })
    socket.on('combat:room-state', ({ players: roomPlayers, started }) => {
      setPlayers(roomPlayers)
      setCombatStarted(started)
    })
    socket.on('combat:started', () => {
      setCombatStarted(true)
      addEvent('Les deux joueurs sont prêts. La partie commence !')
    })
    socket.on('combat:player-joined', ({ playerId }) => addEvent(`Joueur connecté : ${playerId}`))
    socket.on('combat:player-left', ({ playerId, reason }) => {
      addEvent(`${reason === 'left' ? 'Joueur parti' : 'Joueur déconnecté'} : ${playerId}`)
    })
    socket.on('combat:action', ({ action }) => addEvent(`Action reçue : ${action}`))
    socket.on('combat:message', ({ playerId, message: receivedMessage, system }) => {
      setMessages((currentMessages) => [
        { playerId, message: receivedMessage, system },
        ...currentMessages,
      ].slice(0, 30))
    })
    socket.on('combat:error', ({ message }) => addEvent(`Erreur : ${message}`))

    const eventTimers = eventTimersRef.current
    return () => {
      socket.disconnect()
      eventTimers.forEach((timer) => clearTimeout(timer))
      eventTimers.clear()
      socketRef.current = null
    }
  }, [])

  const currentPlayer = players.find((player) => player.playerId === socketId)
  const canReady = Boolean(joinedMatchId) && players.length === 2 && !combatStarted

  function toggleReady() {
    if (!canReady) return
    socketRef.current?.emit('combat:ready', { ready: !currentPlayer?.ready })
  }

  function toggleCombat() {
    if (joinedMatchId) {
      socketRef.current?.emit('combat:leave')
      return
    }

    const trimmedMatchCode = matchCode.trim()
    if (!trimmedMatchCode) {
      setEvents((currentEvents) => [
        { id: `${Date.now()}-${Math.random()}`, message: 'Entrez un code de partie.' },
        ...currentEvents,
      ].slice(0, 8))
      return
    }

    socketRef.current?.emit('combat:join', { matchId: trimmedMatchCode })
  }

  function sendMessage(event) {
    event.preventDefault()
    const trimmedMessage = message.trim()
    if (!trimmedMessage || !joinedMatchId) return

    socketRef.current?.emit('combat:message', { message: trimmedMessage })
    setMessage('')
  }

  return (
    <main className="content-left-spacing combat-page">
      <header className="combat-page-header">
        <div>
          <span className="combat-kicker">Arène en ligne</span>
          <h1>Combat</h1>
          <p>Rejoins une partie avec ton code et retrouve ton groupe dans un chat privé.</p>
        </div>
        <div className={`combat-connection combat-connection-${connectionStatus === 'Connecté' ? 'online' : 'offline'}`}>
          <span aria-hidden="true" />
          {connectionStatus}
        </div>
      </header>

      <section className={`combat-layout ${joinedMatchId ? 'has-combat' : 'join-only'}`} aria-live="polite">
        <div className="combat-join-panel">
          <div className="combat-panel-heading">
            <div>
              <span className="combat-panel-index">01</span>
              <h2>Rejoindre une partie</h2>
            </div>
            <span className="combat-room-lock">Room privée</span>
          </div>
          <p className="combat-panel-copy">Utilise le même code que tes coéquipiers pour entrer dans leur salle.</p>
          <div className="combat-room-controls">
            <label htmlFor="combat-room-code">Code de partie</label>
            <div className="combat-code-row">
              <input
                id="combat-room-code"
                type="text"
                value={matchCode}
                onChange={(event) => setMatchCode(event.target.value)}
                placeholder="MATCH-42"
                maxLength={80}
                pattern="[A-Za-z0-9_-]+"
                disabled={Boolean(joinedMatchId)}
              />
              <button className={joinedMatchId ? 'combat-leave-button' : ''} type="button" onClick={toggleCombat} disabled={connectionStatus !== 'Connecté'}>
                {joinedMatchId ? 'Quitter' : 'Rejoindre'}
              </button>
            </div>
          </div>
          <div className="combat-current-room">
            <span className="combat-current-room-dot" aria-hidden="true" />
            <span>{matchStatus}</span>
          </div>
        </div>

        {joinedMatchId && <div className="combat-chat-panel">
          <div className="combat-panel-heading">
            <div>
              <span className="combat-panel-index">02</span>
              <h2>Chat de la partie</h2>
            </div>
            <span className="combat-message-count">{messages.length}/30</span>
          </div>
          <ul className="combat-messages" aria-live="polite">
            {messages.length === 0 && <li className="combat-empty-message">Rejoins une salle pour commencer la conversation.</li>}
            {messages.map(({ playerId, message: receivedMessage, system }, index) => (
              <li key={`${playerId ?? 'system'}-${index}`} className={system ? 'combat-system-message' : ''}>
                {system ? receivedMessage : <><strong>{playerId}</strong> : {receivedMessage}</>}
              </li>
            ))}
          </ul>
          <form className="combat-chat-form" onSubmit={sendMessage}>
            <label className="visually-hidden" htmlFor="combat-message">Message à la salle</label>
            <div>
              <input
                id="combat-message"
                type="text"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={joinedMatchId ? 'Écrire un message à la salle...' : 'Rejoins une salle pour écrire'}
                maxLength={500}
                disabled={!joinedMatchId}
              />
              <button type="submit" disabled={!joinedMatchId || !message.trim()} aria-label="Envoyer le message">→</button>
            </div>
          </form>
        </div>}

        {joinedMatchId && <aside className="combat-activity-panel">
          <div className="combat-panel-heading">
            <div>
              <span className="combat-panel-index">03</span>
              <h2>Activité</h2>
            </div>
            <span className={`combat-live-label ${combatStarted ? 'combat-started-label' : ''}`}>
              {combatStarted ? 'En cours' : 'Live'}
            </span>
          </div>
          <div className="combat-player-summary">
            <strong>{players.length}/2 joueurs</strong>
            <span>{players.length === 2 ? 'Les deux places sont prises' : 'En attente d’un adversaire'}</span>
          </div>
          <ul className="combat-player-list">
            {players.map((player) => (
              <li key={player.playerId}>
                <span className="combat-player-avatar" aria-hidden="true">{player.playerId.slice(-2)}</span>
                <span className="combat-player-name">{player.playerId === socketId ? 'Vous' : player.playerId}</span>
                <span className={`combat-ready-state ${player.ready ? 'is-ready' : ''}`}>
                  {player.ready ? 'READY' : 'En attente'}
                </span>
              </li>
            ))}
            {players.length === 0 && <li className="combat-empty-message">Rejoins une partie pour voir ses joueurs.</li>}
          </ul>
          {players.length === 2 && !combatStarted && (
            <button className={`combat-ready-button ${currentPlayer?.ready ? 'is-ready' : ''}`} type="button" onClick={toggleReady}>
              {currentPlayer?.ready ? 'READY - Annuler' : 'READY'}
            </button>
          )}
          {combatStarted && <p className="combat-started-message">La partie est lancée. Bon combat !</p>}
          <ul className="combat-events">
            {events.length === 0 && <li className="combat-empty-message">En attente d’activité...</li>}
            {events.map((event) => <li key={event.id}>{event.message}</li>)}
          </ul>
        </aside>}
      </section>
    </main>
  )
}

export default Combat
