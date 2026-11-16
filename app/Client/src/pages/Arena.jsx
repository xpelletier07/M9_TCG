import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useAuth } from '../auth/AuthContext.jsx'
import CombatResult from '../components/CombatResult.jsx'
import LeaveConfirmation from '../components/LeaveConfirmation.jsx'
import ArenaCard from '../components/arena/ArenaCard.jsx'
import ArenaHand from '../components/arena/ArenaHand.jsx'
import ArenaLane from '../components/arena/ArenaLane.jsx'
import ArenaLog from '../components/arena/ArenaLog.jsx'
import DamageNumber from '../components/arena/DamageNumber.jsx'
import PlayerBar from '../components/arena/PlayerBar.jsx'
import TargetingArrow from '../components/arena/TargetingArrow.jsx'
import TurnBanner from '../components/arena/TurnBanner.jsx'
import TurnBar from '../components/arena/TurnBar.jsx'
import useArenaEvents from '../components/arena/useArenaEvents.js'
import useArenaTargeting from '../components/arena/useArenaTargeting.js'
import { API_BASE_URL } from '../config'
import '../css/Arena.css'

const RESULT_REDIRECT_MS = 8000

function Arena() {
  const { user, token } = useAuth()
  const { matchId } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const myUserIdRef = useRef(user?.id ?? null)
  const isChatOpenRef = useRef(false)
  const resultTimerRef = useRef(null)
  const previewTimerRef = useRef(null)
  const toastTimerRef = useRef(null)
  const [connectionStatus, setConnectionStatus] = useState('Connexion...')
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [messagePreview, setMessagePreview] = useState(null)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false)
  const [combatResult, setCombatResult] = useState(null)
  const [toast, setToast] = useState(null)
  const { displayedState: gs, effects, damageNumbers, banner, logEntries, clockOffset, enqueue, isAnimating } = useArenaEvents()

  const showToast = useCallback((text) => {
    setToast(text)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2600)
  }, [])

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
    socket.on('combat:connected', ({ profile }) => {
      if (profile?.id) myUserIdRef.current = profile.id
    })
    socket.on('combat:game-state', (state) => enqueue(state))
    socket.on('combat:action-error', ({ message: errorMessage }) => showToast(errorMessage))
    socket.on('combat:ended', (ended) => {
      const result = {
        result: ended.winnerUserId === myUserIdRef.current ? 'victory' : 'defeat',
        reason: ended.reason,
        winnerName: ended.winnerName,
        loserName: ended.loserName,
      }
      setShowLeaveConfirmation(false)
      // On laisse la dernière animation (coup fatal) se terminer avant d'afficher le résultat
      const reveal = () => {
        if (isAnimating()) {
          resultTimerRef.current = setTimeout(reveal, 150)
          return
        }
        setCombatResult(result)
        resultTimerRef.current = setTimeout(() => navigate('/combat', { replace: true }), RESULT_REDIRECT_MS)
      }
      reveal()
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
      clearTimeout(previewTimerRef.current)
      clearTimeout(resultTimerRef.current)
      clearTimeout(toastTimerRef.current)
      socketRef.current = null
    }
  }, [matchId, navigate, token, enqueue, isAnimating, showToast])

  const isMyTurn = Boolean(gs?.isMyTurn) && !combatResult && gs?.winnerId == null

  const targeting = useArenaTargeting({
    enabled: isMyTurn,
    onPlay: (instanceId) => socketRef.current?.emit('combat:play-card', { instanceId }),
    onAttack: (attackerInstanceId, target) => socketRef.current?.emit('combat:attack', { attackerInstanceId, target }),
  })

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

  function endTurn() {
    targeting.cancel()
    socketRef.current?.emit('combat:end-turn')
  }

  // Clic dans le vide : on annule la sélection d'un attaquant
  function onBackgroundClick(event) {
    if (!targeting.selectedAttackerId) return
    if (event.target.closest('[data-instance-id], [data-target="player"], button')) return
    targeting.cancel()
  }

  const { drag, aiming } = targeting
  const isDraggingCard = drag?.kind === 'play'
  // Tant que l'adversaire a une créature sur le terrain, on ne peut pas l'attaquer directement
  const isOpponentShielded = (gs?.opponent.board.length ?? 0) > 0

  return (
    <main className="content-left-spacing arena-page">
      {showLeaveConfirmation && !combatResult && (
        <LeaveConfirmation onCancel={() => setShowLeaveConfirmation(false)} onConfirm={() => {
          setShowLeaveConfirmation(false)
          socketRef.current?.emit('combat:leave')
        }} />
      )}
      {combatResult && (
        <CombatResult
          result={combatResult}
          onDashboard={() => navigate('/')}
          onLobby={() => navigate('/combat', { replace: true })}
        />
      )}

      <div className={`arena ${aiming ? 'is-aiming' : ''} ${isDraggingCard ? 'is-dragging-card' : ''}`} onClick={onBackgroundClick}>
        <header className="arena-header">
          <div>
            <span className="arena-kicker">Arène de combat</span>
            <h1 className="arena-title">Match {matchId}</h1>
          </div>
          <div className="arena-header-actions">
            <span className={`arena-connection ${connectionStatus === 'Connecté' ? 'is-online' : 'is-offline'}`}>
              <span aria-hidden="true" />
              {connectionStatus}
            </span>
            {!combatResult && (
              <button className="arena-leave" type="button" onClick={() => setShowLeaveConfirmation(true)}>
                Abandonner
              </button>
            )}
          </div>
        </header>

        {!gs ? (
          <div className="arena-loading">
            <span className="arena-loading-orb" aria-hidden="true" />
            <p>Chargement de la partie…</p>
          </div>
        ) : (
          <div className="arena-stage">
            <section className="arena-table" aria-label="Plateau de combat">
              <PlayerBar
                player={gs.opponent}
                name={gs.opponentName}
                side="opponent"
                active={!gs.isMyTurn}
                targetable={aiming && !isOpponentShielded}
                shielded={isOpponentShielded}
                effect={effects['player-opponent']}
                {...(isOpponentShielded ? {} : targeting.bindTarget({ type: 'player' }))}
              />

              <ArenaLane side="opponent" isEmpty={gs.opponent.board.length === 0}>
                {gs.opponent.board.map((card) => (
                  <ArenaCard
                    key={card.instanceId}
                    card={card}
                    targetable={aiming}
                    effect={effects[card.instanceId]}
                    {...targeting.bindTarget({ type: 'card', instanceId: card.instanceId })}
                  />
                ))}
              </ArenaLane>

              <TurnBar
                turn={gs.turn}
                isMyTurn={gs.isMyTurn}
                opponentName={gs.opponentName}
                turnEndsAt={gs.turnEndsAt}
                clockOffset={clockOffset}
                onEndTurn={endTurn}
                disabled={!isMyTurn}
              />

              <ArenaLane side="me" isEmpty={gs.me.board.length === 0} isDropActive={isDraggingCard}>
                {gs.me.board.map((card) => (
                  <ArenaCard
                    key={card.instanceId}
                    card={card}
                    canAttack={isMyTurn && card.canAttack}
                    selected={targeting.selectedAttackerId === card.instanceId || (drag?.kind === 'attack' && drag.instanceId === card.instanceId)}
                    effect={effects[card.instanceId]}
                    {...targeting.bindBoardCard(card)}
                  />
                ))}
              </ArenaLane>

              <PlayerBar
                player={gs.me}
                name={gs.myName}
                side="me"
                active={gs.isMyTurn}
                effect={effects['player-me']}
              />

              <ArenaHand
                cards={gs.me.hand}
                renderCard={(card, fanStyle) => {
                  const playable = isMyTurn && card.mana <= gs.me.mana
                  const dragging = isDraggingCard && drag.instanceId === card.instanceId
                  const style = dragging
                    ? { ...fanStyle, '--drag-x': `${drag.x - drag.startX}px`, '--drag-y': `${drag.y - drag.startY}px`, zIndex: 50 }
                    : fanStyle
                  return (
                    <ArenaCard
                      key={card.instanceId}
                      card={card}
                      variant="hand"
                      playable={playable}
                      dimmed={!playable}
                      dragging={dragging}
                      effect={effects[card.instanceId]}
                      style={style}
                      {...targeting.bindHandCard(card, playable)}
                    />
                  )
                }}
              />
              <TurnBanner banner={banner} />
            </section>

            <ArenaLog entries={logEntries} />
          </div>
        )}

        <TargetingArrow drag={drag} />
        {damageNumbers.map((d) => <DamageNumber key={d.id} amount={d.amount} x={d.x} y={d.y} />)}
        {aiming && !drag && (
          <div className="arena-hint" role="status">Choisis une cible · Échap pour annuler</div>
        )}
        {toast && <div className="arena-toast" role="alert">{toast}</div>}
      </div>

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
