import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useAuth } from '../auth/AuthContext.jsx'
import CombatResult from '../components/CombatResult.jsx'
import LeaveConfirmation from '../components/LeaveConfirmation.jsx'
import { API_BASE_URL } from '../config'

function Arena() {
  const { user, token } = useAuth()
  const { matchId } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const isChatOpenRef = useRef(false)
  const combatResultRef = useRef(null)
  const resultTimerRef = useRef(null)
  const previewTimerRef = useRef(null)
  const [connectionStatus, setConnectionStatus] = useState('Connexion...')
  const [socketId, setSocketId] = useState(null)
  const [currentProfile, setCurrentProfile] = useState(user)
  const [players, setPlayers] = useState([])
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [messagePreview, setMessagePreview] = useState(null)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false)
  const [combatResult, setCombatResult] = useState(null)

  useEffect(() => {
    if (!matchId) {
      navigate('/combat', { replace: true })
      return undefined
    }

    const socket = io(`${API_BASE_URL}/combat`, {
      autoConnect: false,
      auth: { token },
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnectionStatus('Connecté')
      socket.emit('combat:join', { matchId, phase: 'arena' })
    })
    socket.on('disconnect', () => setConnectionStatus('Déconnecté'))
    socket.on('connect_error', () => {
      setConnectionStatus('Serveur indisponible')
      navigate('/combat', { replace: true })
    })
    socket.on('combat:connected', ({ socketId: connectedSocketId, profile: connectedProfile }) => {
      setSocketId(connectedSocketId)
      setCurrentProfile(connectedProfile)
    })
    socket.on('combat:room-state', ({ players: roomPlayers }) => {
      setPlayers(roomPlayers)
    })
    socket.on('combat:ended', ({ winnerId, loserId, winnerName, loserName, reason }) => {
      const result = {
        result: winnerId === socket.id ? 'victory' : 'defeat',
        reason,
        winnerId,
        loserId,
        winnerName,
        loserName,
      }
      combatResultRef.current = result
      setShowLeaveConfirmation(false)
      setCombatResult(result)
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
      resultTimerRef.current = setTimeout(() => navigate('/combat', { replace: true }), 3000)
    })
    socket.on('combat:message', ({ playerId, playerName, message: receivedMessage, system }) => {
      const newMessage = { playerId, playerName, message: receivedMessage, system }
      setMessages((currentMessages) => [newMessage, ...currentMessages].slice(0, 30))
      if (!isChatOpenRef.current) setUnreadMessageCount((count) => count + 1)
      setMessagePreview(newMessage)
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      previewTimerRef.current = setTimeout(() => setMessagePreview(null), 4000)
    })
    socket.on('combat:left', () => navigate('/combat', { replace: true }))
    socket.on('combat:error', ({ message: errorMessage }) => {
      setConnectionStatus(errorMessage)
      navigate('/combat', { replace: true })
    })

    socket.connect()

    return () => {
      socket.disconnect()
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
      socketRef.current = null
    }
  }, [matchId, navigate, token])

  function sendMessage(event) {
    event.preventDefault()
    const trimmedMessage = message.trim()
    if (!trimmedMessage) return
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

  function requestLeaveArena() {
    setShowLeaveConfirmation(true)
  }

  function cancelLeaveArena() {
    setShowLeaveConfirmation(false)
  }

  function confirmLeaveArena() {
    setShowLeaveConfirmation(false)
    socketRef.current?.emit('combat:leave')
  }

  return (
    <main className="content-left-spacing combat-arena-page">
      <header className="combat-arena-header">
        <div>
          <span className="combat-kicker">Arène de combat</span>
          <h1>Match {matchId}</h1>
          <p>La partie est lancée. Prépare ton prochain mouvement.</p>
        </div>
        <div className="combat-connection combat-connection-online">
          <span aria-hidden="true" />
          {connectionStatus}
        </div>
      </header>

      {showLeaveConfirmation && !combatResult && (
        <LeaveConfirmation onCancel={cancelLeaveArena} onConfirm={confirmLeaveArena} />
      )}
      {combatResult && <CombatResult result={combatResult} onDashboard={() => navigate('/')} />}

      {!combatResult && <section className="combat-arena-board" aria-label="Plateau de combat">
        <div className="combat-arena-player combat-arena-player-opponent">
          <span className="combat-arena-player-label">Adversaire</span>
          <strong>{players.find((player) => player.playerId !== socketId)?.profile?.nom_utilisateur ?? 'En attente'}</strong>
        </div>
        <div className="combat-arena-divider" aria-hidden="true">VS</div>
        <div className="combat-arena-player combat-arena-player-you">
          <span className="combat-arena-player-label">Toi</span>
          <strong>{currentProfile?.nom_utilisateur ?? 'Connexion...'}</strong>
        </div>
        <div className="combat-arena-play-zone">
          <span>Zone de jeu</span>
          <p>Ton plateau sera affiché ici pour jouer tes cartes.</p>
        </div>
      </section>}

      {!combatResult && <button className="combat-arena-leave" type="button" onClick={requestLeaveArena}>Abandonner le combat</button>}

      <div className={`combat-chat-widget ${isChatOpen ? 'is-open' : ''}`}>
        {!isChatOpen && messagePreview && (
          <div className="combat-chat-preview" role="status">
            <strong>{messagePreview.system ? 'Arène' : (messagePreview.playerName ?? messagePreview.playerId)}</strong>
            <span>{messagePreview.message}</span>
          </div>
        )}
        {isChatOpen && (
          <div className="combat-chat-popover">
            <div className="combat-chat-popover-header">
              <div><span className="combat-panel-index">Chat</span><h2>Chat de l’arène</h2></div>
              <span className="combat-message-count">{messages.length}/30</span>
            </div>
            <ul className="combat-messages" aria-live="polite">
              {messages.length === 0 && <li className="combat-empty-message">Aucun message pour le moment.</li>}
              {messages.map(({ playerId, playerName, message: receivedMessage, system }, index) => (
                <li key={`${playerId ?? 'system'}-${index}`} className={system ? 'combat-system-message' : ''}>
                  {system ? receivedMessage : <><strong>{playerName ?? playerId}</strong> : {receivedMessage}</>}
                </li>
              ))}
            </ul>
            <form className="combat-chat-form" onSubmit={sendMessage}>
              <label className="visually-hidden" htmlFor="arena-message">Message à la salle</label>
              <div>
                <input id="arena-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Écrire un message..." maxLength={500} />
                <button type="submit" disabled={!message.trim()} aria-label="Envoyer le message">→</button>
              </div>
            </form>
          </div>
        )}
        <button className="combat-chat-toggle" type="button" onClick={toggleChat} aria-expanded={isChatOpen}>
          <span aria-hidden="true">☵</span>
          <span>{isChatOpen ? 'Fermer' : 'Chat'}</span>
          {!isChatOpen && unreadMessageCount > 0 && <b>{unreadMessageCount}</b>}
        </button>
      </div>
    </main>
  )
}

export default Arena
