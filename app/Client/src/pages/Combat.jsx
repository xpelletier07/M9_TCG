import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'




function Combat() {
  const socketRef = useRef(null)
  const previewTimerRef = useRef(null)
  const isChatOpenRef = useRef(false)
  const joinedMatchRef = useRef(false)
  const navigate = useNavigate()
  const [connectionStatus, setConnectionStatus] = useState('Déconnecté')
  const [matchStatus, setMatchStatus] = useState('Aucun combat rejoint')
  const [joinedMatchId, setJoinedMatchId] = useState(null)
  const [socketId, setSocketId] = useState(null)
  const [players, setPlayers] = useState([])
  const [combatStarted, setCombatStarted] = useState(false)
  const [matchCode, setMatchCode] = useState('')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [messagePreview, setMessagePreview] = useState(null)

  function resetCombatState() {
    setJoinedMatchId(null)
    setMatchStatus('Aucun combat rejoint')
    setPlayers([])
    setCombatStarted(false)
    setMessages([])
    setUnreadMessageCount(0)
    setMessage('')
    setMessagePreview(null)
    setIsChatOpen(false)
  }

  function connectToCombat(matchId) {
    const socket = io(`${API_BASE_URL}/combat`, { autoConnect: false })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnectionStatus('Connecté')
      socket.emit('combat:join', { matchId })
    })
    socket.on('disconnect', () => {
      setConnectionStatus('Déconnecté')
      setSocketId(null)
      if (socketRef.current === socket) socketRef.current = null
    })
    socket.on('connect_error', () => {
      setConnectionStatus('Serveur indisponible')
      socket.disconnect()
    })
    socket.on('combat:connected', ({ socketId: connectedSocketId }) => {
      setSocketId(connectedSocketId)
    })
    socket.on('combat:joined', ({ matchId }) => {
      joinedMatchRef.current = true
      setJoinedMatchId(matchId)
      setCombatStarted(false)
      setMatchStatus(`Combat rejoint : ${matchId}`)
    })
    socket.on('combat:left', () => {
      joinedMatchRef.current = false
      resetCombatState()
      socket.disconnect()
      navigate('/combat')
    })
    socket.on('combat:room-state', ({ players: roomPlayers, started }) => {
      setPlayers(roomPlayers)
      setCombatStarted(started)
    })
    socket.on('combat:started', () => {
      setCombatStarted(true)
      navigate(`/combat/${matchId}`)
    })
    socket.on('combat:message', ({ playerId, message: receivedMessage, system }) => {
      const newMessage = { playerId, message: receivedMessage, system }
      setMessages((currentMessages) => [
        newMessage,
        ...currentMessages,
      ].slice(0, 30))
      if (!isChatOpenRef.current) {
        setUnreadMessageCount((count) => count + 1)
      }
      setMessagePreview(newMessage)
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      previewTimerRef.current = setTimeout(() => {
        setMessagePreview(null)
        previewTimerRef.current = null
      }, 4000)
    })
    socket.on('combat:error', ({ message }) => {
      setMatchStatus(`Erreur : ${message}`)
      if (!joinedMatchRef.current) socket.disconnect()
    })

    socket.connect()
  }

  useEffect(() => {
    isChatOpenRef.current = isChatOpen
  }, [isChatOpen])

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect()
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
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
      setMatchStatus('Entrez un code de partie.')
      return
    }

    setConnectionStatus('Connexion...')
    connectToCombat(trimmedMatchCode)
  }

  function sendMessage(event) {
    event.preventDefault()
    const trimmedMessage = message.trim()
    if (!trimmedMessage || !joinedMatchId) return

    socketRef.current?.emit('combat:message', { message: trimmedMessage })
    setMessage('')
  }

  function toggleChat() {
    setIsChatOpen((open) => {
      const nextOpen = !open
      isChatOpenRef.current = nextOpen
      if (nextOpen) setUnreadMessageCount(0)
      return nextOpen
    })
  }

  return (
    <main className={`content-left-spacing combat-page ${joinedMatchId ? 'is-joined' : ''}`}>
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
              <button className={joinedMatchId ? 'combat-leave-button' : ''} type="button" onClick={toggleCombat} disabled={connectionStatus === 'Connexion...'}>
                {joinedMatchId ? 'Quitter' : 'Rejoindre'}
              </button>
            </div>
          </div>
          <div className="combat-current-room">
            <span className="combat-current-room-dot" aria-hidden="true" />
            <span>{matchStatus}</span>
          </div>
        </div>

        {joinedMatchId && <div className={`combat-chat-widget ${isChatOpen ? 'is-open' : ''}`}>
          {!isChatOpen && messagePreview && (
            <div className="combat-chat-preview" role="status">
              <strong>{messagePreview.system ? 'Arène' : messagePreview.playerId}</strong>
              <span>{messagePreview.message}</span>
            </div>
          )}
          {isChatOpen && (
            <div className="combat-chat-popover">
              <div className="combat-chat-popover-header">
                <div>
                  <span className="combat-panel-index">02</span>
                  <h2>Chat de l’arène</h2>
                </div>
                <span className="combat-message-count">{messages.length}/30</span>
              </div>
              <ul className="combat-messages" aria-live="polite">
                {messages.length === 0 && <li className="combat-empty-message">Aucun message pour le moment.</li>}
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
                    placeholder="Écrire un message..."
                    maxLength={500}
                  />
                  <button type="submit" disabled={!message.trim()} aria-label="Envoyer le message">→</button>
                </div>
              </form>
            </div>
          )}
          <button
            className="combat-chat-toggle"
            type="button"
            onClick={toggleChat}
            aria-expanded={isChatOpen}
            aria-label={isChatOpen ? 'Fermer le chat' : 'Ouvrir le chat'}
          >
            <span aria-hidden="true">☵</span>
            <span>{isChatOpen ? 'Fermer' : 'Chat'}</span>
            {!isChatOpen && unreadMessageCount > 0 && <b>{unreadMessageCount}</b>}
          </button>
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
        </aside>}
      </section>
    </main>
  )
}

export default Combat
