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
  const [gameState, setGameState] = useState(null)
  const [selectedBoardCard, setSelectedBoardCard] = useState(null)

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
    socket.on('combat:game-state', (gs) => {
      setGameState(gs)
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
      resultTimerRef.current = setTimeout(() => navigate('/combat', { replace: true }), 5000)
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

  function playCard(instanceId) {
    socketRef.current?.emit('combat:play-card', { instanceId })
  }

  function selectAttacker(instanceId) {
    setSelectedBoardCard((prev) => (prev === instanceId ? null : instanceId))
  }

  function attackTarget(targetType, targetInstanceId) {
    if (!selectedBoardCard) return
    socketRef.current?.emit('combat:attack', {
      attackerInstanceId: selectedBoardCard,
      targetType,
      targetInstanceId,
    })
    setSelectedBoardCard(null)
  }

  function endTurn() {
    socketRef.current?.emit('combat:end-turn')
    setSelectedBoardCard(null)
  }

  const opponentName = gameState?.opponentName
    ?? players.find((p) => p.playerId !== socketId)?.profile?.nom_utilisateur
    ?? 'En attente'

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

      {!combatResult && (
        <section className="combat-arena-board" aria-label="Plateau de combat">
          {!gameState ? (
            <div className="combat-arena-play-zone">
              <span>Chargement de la partie…</span>
              <p>En attente de l'état du jeu.</p>
            </div>
          ) : (
            <div className="combat-game-board">

              {/* Barre adversaire */}
              <div
                className={`combat-player-bar ${!gameState.isMyTurn ? 'is-active-turn' : ''} ${selectedBoardCard && gameState.isMyTurn ? 'is-targetable-player' : ''}`}
                onClick={() => selectedBoardCard && gameState.isMyTurn && attackTarget('player', null)}
              >
                <span className="combat-player-name">{opponentName}</span>
                <div className="combat-hp-display">
                  <div className="combat-hp-bar">
                    <div
                      className="combat-hp-bar-fill combat-hp-bar-fill--opponent"
                      style={{ width: `${(gameState.opponentState.hp / 50) * 100}%` }}
                    />
                    <span>{gameState.opponentState.hp} / 50 PV</span>
                  </div>
                </div>
                <div className="combat-mana-row">
                  <span className="combat-mana-label">
                    Mana {gameState.opponentState.mana}/{gameState.opponentState.maxMana}
                  </span>
                  <div className="combat-mana-crystals">
                    {Array.from({ length: Math.max(gameState.opponentState.maxMana, 0) }, (_, i) => (
                      <span
                        key={i}
                        className={`combat-mana-crystal ${i < gameState.opponentState.mana ? 'is-full' : ''}`}
                      />
                    ))}
                  </div>
                </div>
                <span className="combat-deck-count">
                  {gameState.opponentState.handCount} en main · {gameState.opponentState.deckCount} deck
                </span>
                {selectedBoardCard && gameState.isMyTurn && (
                  <span className="combat-attack-hint">Cliquer pour attaquer directement</span>
                )}
              </div>

              {/* Plateau adversaire */}
              <div className="combat-board combat-board--opponent">
                {gameState.opponentState.board.length === 0 && (
                  <span className="combat-board-empty">Terrain vide</span>
                )}
                {gameState.opponentState.board.map((card) => (
                  <div
                    key={card.instanceId}
                    className={`combat-card ${selectedBoardCard && gameState.isMyTurn ? 'is-targetable' : ''}`}
                    onClick={() => selectedBoardCard && gameState.isMyTurn && attackTarget('card', card.instanceId)}
                  >
                    <span className="combat-card-name">{card.nom_carte}</span>
                    <div className="combat-card-stats">
                      <span className="combat-card-attack" title="Attaque">{card.damage}</span>
                      <span
                        className="combat-card-hp"
                        style={{ color: card.currentHp < card.health ? '#f29b73' : undefined }}
                        title="PV"
                      >
                        {card.currentHp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Barre de tour */}
              <div className="combat-turn-bar">
                <span className="combat-turn-count">Tour {gameState.turn}</span>
                {gameState.isMyTurn ? (
                  <button className="combat-end-turn-btn" type="button" onClick={endTurn}>
                    Fin du tour
                  </button>
                ) : (
                  <span className="combat-waiting-label">Tour de {opponentName}…</span>
                )}
                {selectedBoardCard && (
                  <button
                    className="combat-cancel-btn"
                    type="button"
                    onClick={() => setSelectedBoardCard(null)}
                  >
                    Annuler
                  </button>
                )}
              </div>

              {/* Plateau joueur */}
              <div className="combat-board combat-board--mine">
                {gameState.myState.board.length === 0 && (
                  <span className="combat-board-empty">Jouez des cartes ici</span>
                )}
                {gameState.myState.board.map((card) => (
                  <div
                    key={card.instanceId}
                    className={`combat-card ${selectedBoardCard === card.instanceId ? 'is-selected' : ''} ${card.canAttack && gameState.isMyTurn ? 'can-attack' : ''}`}
                    onClick={() => gameState.isMyTurn && card.canAttack && selectAttacker(card.instanceId)}
                  >
                    {card.canAttack && gameState.isMyTurn && (
                      <span className="combat-card-can-attack-badge">ATQ</span>
                    )}
                    <span className="combat-card-name">{card.nom_carte}</span>
                    <div className="combat-card-stats">
                      <span className="combat-card-attack" title="Attaque">{card.damage}</span>
                      <span
                        className="combat-card-hp"
                        style={{ color: card.currentHp < card.health ? '#f29b73' : undefined }}
                        title="PV"
                      >
                        {card.currentHp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Barre joueur */}
              <div className={`combat-player-bar combat-player-bar--mine ${gameState.isMyTurn ? 'is-active-turn' : ''}`}>
                <span className="combat-player-name">{gameState.myName}</span>
                <div className="combat-hp-display">
                  <div className="combat-hp-bar">
                    <div
                      className="combat-hp-bar-fill combat-hp-bar-fill--mine"
                      style={{ width: `${(gameState.myState.hp / 50) * 100}%` }}
                    />
                    <span>{gameState.myState.hp} / 50 PV</span>
                  </div>
                </div>
                <div className="combat-mana-row">
                  <span className="combat-mana-label">
                    Mana {gameState.myState.mana}/{gameState.myState.maxMana}
                  </span>
                  <div className="combat-mana-crystals">
                    {Array.from({ length: Math.max(gameState.myState.maxMana, 0) }, (_, i) => (
                      <span
                        key={i}
                        className={`combat-mana-crystal ${i < gameState.myState.mana ? 'is-full' : ''}`}
                      />
                    ))}
                  </div>
                </div>
                <span className="combat-deck-count">{gameState.myState.deckCount} cartes restantes</span>
              </div>

              {/* Main du joueur */}
              <div className="combat-hand" aria-label="Cartes en main">
                {gameState.myState.hand.length === 0 && (
                  <span className="combat-hand-empty">Aucune carte en main</span>
                )}
                {gameState.myState.hand.map((card) => {
                  const canPlay = gameState.isMyTurn && card.mana <= gameState.myState.mana
                  return (
                    <div
                      key={card.instanceId}
                      className={`combat-card combat-card--hand ${canPlay ? 'can-play' : 'cannot-play'}`}
                      onClick={() => canPlay && playCard(card.instanceId)}
                    >
                      <span className="combat-card-mana-cost">{card.mana}</span>
                      <span className="combat-card-name">{card.nom_carte}</span>
                      <div className="combat-card-stats">
                        <span className="combat-card-attack" title="Attaque">{card.damage}</span>
                        <span className="combat-card-hp" title="PV">{card.health}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          )}
        </section>
      )}

      {!combatResult && (
        <button className="combat-arena-leave" type="button" onClick={requestLeaveArena}>
          Abandonner le combat
        </button>
      )}

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
              <div><span className="combat-panel-index">Chat</span><h2>Chat de l'arène</h2></div>
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
                <input
                  id="arena-message"
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
