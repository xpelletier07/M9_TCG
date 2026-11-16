import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import DeckPickerModal from '../components/combat/DeckPickerModal.jsx'
import DeckSlot from '../components/combat/DeckSlot.jsx'
import { API_BASE_URL } from '../config'
import { useCombat } from '../context/CombatContext.jsx'
import '../css/DeckPicker.css'
import '../css/Matchmaking.css'

function generateMatchCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

function initials(name) {
  return (name ?? '?').trim().slice(0, 2).toUpperCase()
}

function Combat() {
  const { user, token } = useAuth()
  const {
    connectionStatus,
    notice,
    setNotice,
    joinedMatchId,
    socketId,
    players,
    combatStarted,
    lobbies,
    messages,
    roomIsPrivate,
    selectedDeck,
    joinMatch,
    leaveMatch,
    selectDeck,
    toggleReady,
    sendMessage: emitMessage,
  } = useCombat()
  const chatEndRef = useRef(null)
  const [matchCode, setMatchCode] = useState('')
  const [message, setMessage] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isDeckPickerOpen, setIsDeckPickerOpen] = useState(false)
  const [validDecks, setValidDecks] = useState([])
  const [decksLoading, setDecksLoading] = useState(false)
  const [decksError, setDecksError] = useState(null)

  const currentPlayer = players.find((player) => player.playerId === socketId)
  const opponent = players.find((player) => player.playerId !== socketId)
  const isOnline = connectionStatus === 'Connecté'
  const visibleLobbies = lobbies.filter((lobby) => lobby.matchId !== joinedMatchId && lobby.hostId !== user?.id)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, joinedMatchId])

  // Le deck ne peut plus changer une fois prêt ou la partie lancée
  const canChangeDeck = !combatStarted && !currentPlayer?.ready
  // Pour être prêt : un deck choisi et un adversaire dans la salle (annuler reste toujours possible)
  const readyBlocker = !selectedDeck
    ? 'Choisis un deck pour être prêt.'
    : players.length < 2
      ? 'En attente d’un adversaire pour être prêt.'
      : null
  const canToggleReady = Boolean(currentPlayer?.ready) || !readyBlocker

  async function openDeckPicker() {
    setIsDeckPickerOpen(true)
    setDecksLoading(true)
    setDecksError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/combat/decks`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Erreur serveur')
      setValidDecks(await response.json())
    } catch {
      setDecksError('Impossible de charger tes decks.')
    } finally {
      setDecksLoading(false)
    }
  }

  function chooseDeck(deck) {
    selectDeck(deck.id_deck)
    setIsDeckPickerOpen(false)
  }

  function createMatch() {
    joinMatch(generateMatchCode(), isPrivate)
  }

  function submitCode(event) {
    event.preventDefault()
    const code = matchCode.trim()
    if (!code) {
      setNotice('Entre un code de partie.')
      return
    }
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      setNotice('Le code ne peut contenir que des lettres, chiffres, - et _.')
      return
    }
    joinMatch(code)
  }

  function sendMessage(event) {
    event.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || !joinedMatchId) return
    emitMessage(trimmed)
    setMessage('')
  }
  const statusLabel = combatStarted ? 'Combat en cours' : players.length === 2 ? 'Adversaire trouvé' : 'En attente d’un adversaire'

  return (
    <main className="content-left-spacing mm-page">
      <div className="mm-container">
        {!joinedMatchId ? (
          <>
            <header className="mm-top">
              <div>
                <h1>Matchmaking</h1>
                <p>Rejoins une partie ouverte ou crée ta propre salle pour défier un autre dresseur.</p>
              </div>
              <span className="mm-conn">
                <span className={`mm-dot ${isOnline ? 'is-online' : ''}`} aria-hidden="true" />
                {connectionStatus}
              </span>
            </header>

            {notice && <p className="mm-notice" role="alert">{notice}</p>}

            <div className="mm-board">
              <section className="mm-panel mm-lobbies" aria-label="Parties ouvertes">
                <div className="mm-panel-head">
                  <div>
                    <h2>Parties ouvertes</h2>
                    <p>Des joueurs t’attendent pour un duel.</p>
                  </div>
                  <span className="mm-count">{visibleLobbies.length}</span>
                </div>

                {visibleLobbies.length === 0 ? (
                  <div className="mm-empty">
                    <div className="mm-empty-icon" aria-hidden="true">⚔</div>
                    <strong>Aucune partie en attente</strong>
                    <span>Crée une partie : elle apparaîtra ici pour les autres joueurs.</span>
                  </div>
                ) : (
                  <ul className="mm-lobby-list">
                    {visibleLobbies.map((lobby) => (
                      <li key={lobby.matchId}>
                        <span className="mm-avatar" aria-hidden="true">{initials(lobby.hostName)}</span>
                        <div className="mm-lobby-info">
                          <strong>{lobby.hostName}</strong>
                          <span><i className="mm-dot is-online" aria-hidden="true" /> En attente · 1/2 · {lobby.matchId}</span>
                        </div>
                        <button type="button" className="mm-btn mm-btn-primary" onClick={() => joinMatch(lobby.matchId)} disabled={!isOnline}>
                          Rejoindre
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <aside className="mm-panel mm-code">
                <div className="mm-create">
                  <h2>Créer une partie</h2>
                  <p>Ouvre une salle et attends qu’un adversaire te rejoigne.</p>
                  <label className="mm-switch">
                    <span className="mm-switch-text">Partie privée</span>
                    <input type="checkbox" role="switch" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
                    <span className="mm-switch-track" aria-hidden="true" />
                  </label>
                  <button type="button" className="mm-btn mm-btn-primary mm-btn-block" onClick={createMatch} disabled={!isOnline}>Créer une partie</button>
                </div>
                <h2>Rejoindre avec un code</h2>
                <p>Un ami t’a invité ? Entre le code de sa partie, publique ou privée.</p>
                <form onSubmit={submitCode}>
                  <label className="visually-hidden" htmlFor="mm-code">Code de partie</label>
                  <input
                    id="mm-code"
                    type="text"
                    value={matchCode}
                    onChange={(event) => setMatchCode(event.target.value)}
                    placeholder="MATCH-42"
                    maxLength={80}
                    autoComplete="off"
                  />
                  <button type="submit" className="mm-btn mm-btn-primary mm-btn-block" disabled={!isOnline}>Rejoindre</button>
                </form>
              </aside>
            </div>
          </>
        ) : (
          <>
            {notice && <p className="mm-notice" role="alert">{notice}</p>}
            <section className="mm-room" aria-live="polite">
              <div className="mm-stage">
                <div className="mm-stage-glow" aria-hidden="true" />
                <div className="mm-stage-top">
                  <div>
                    <span className="mm-stage-tag">{roomIsPrivate ? '🔒 Salle privée' : 'Salle publique'}</span>
                    <h2>{joinedMatchId}</h2>
                  </div>
                  <span className={`mm-pill ${combatStarted || players.length === 2 ? 'is-ok' : ''}`}>{statusLabel}</span>
                </div>
                {roomIsPrivate && players.length < 2 && (
                  <p className="mm-room-hint">Partage ce code avec ton adversaire pour qu’il te rejoigne.</p>
                )}

                <div className="mm-versus">
                  <div className="mm-fighter">
                    <span className={`mm-avatar mm-avatar-lg ${currentPlayer?.ready ? 'is-ready' : ''}`}>
                      {initials(currentPlayer?.profile?.nom_utilisateur ?? user?.nom_utilisateur)}
                    </span>
                    <strong>{currentPlayer?.profile?.nom_utilisateur ?? user?.nom_utilisateur ?? 'Toi'}</strong>
                    <span className={`mm-ready ${currentPlayer?.ready ? 'is-ready' : ''}`}>{currentPlayer?.ready ? '✓ Prêt' : 'Pas prêt'}</span>
                  </div>
                  <span className="mm-vs" aria-hidden="true">VS</span>
                  <div className={`mm-fighter ${opponent ? '' : 'is-waiting'}`}>
                    <span className={`mm-avatar mm-avatar-lg ${opponent?.ready ? 'is-ready' : ''}`}>
                      {opponent ? initials(opponent.profile?.nom_utilisateur) : '?'}
                    </span>
                    <strong>{opponent?.profile?.nom_utilisateur ?? 'En attente…'}</strong>
                    <span className={`mm-ready ${opponent?.ready ? 'is-ready' : ''}`}>
                      {opponent ? (opponent.ready ? '✓ Prêt' : 'Pas prêt') : 'Place libre'}
                    </span>
                    {opponent && !combatStarted && (
                      <span className={`mm-deck-flag ${opponent.hasDeck ? 'is-ok' : ''}`}>
                        {opponent.hasDeck ? 'Deck choisi ✓' : 'Choisit son deck…'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mm-room-actions">
                  {!combatStarted && (
                    <div className="mm-ready-group">
                      <DeckSlot deck={selectedDeck} onClick={openDeckPicker} disabled={!canChangeDeck} />
                      <button
                        type="button"
                        className={`mm-cta ${currentPlayer?.ready ? 'is-secondary' : ''}`}
                        onClick={toggleReady}
                        disabled={!canToggleReady}
                        title={canToggleReady ? undefined : readyBlocker}
                      >
                        {currentPlayer?.ready ? 'Annuler' : 'Je suis prêt'}
                      </button>
                    </div>
                  )}
                  <button type="button" className="mm-leave" onClick={leaveMatch}>Quitter la salle</button>
                </div>
                {!combatStarted && !currentPlayer?.ready && readyBlocker && (
                  <p className="mm-room-hint mm-deck-hint">{readyBlocker}</p>
                )}
              </div>

              <aside className="mm-chat" aria-label="Chat de la salle">
                <div className="mm-chat-head">
                  <h3>Chat de la salle</h3>
                  <span>{players.length}/2 en ligne</span>
                </div>
                <ul className="mm-chat-messages" aria-live="polite">
                  {messages.length === 0 && <li className="mm-chat-empty">Aucun message. Dis bonjour !</li>}
                  {messages.map(({ playerId, playerName, message: receivedMessage, system }, index) => (
                    <li
                      key={`${playerId ?? 'system'}-${index}`}
                      className={system ? 'is-system' : playerId === socketId ? 'is-mine' : 'is-theirs'}
                    >
                      {!system && playerId !== socketId && <strong>{playerName ?? playerId}</strong>}
                      <span>{receivedMessage}</span>
                    </li>
                  ))}
                  <li ref={chatEndRef} aria-hidden="true" className="mm-chat-end" />
                </ul>
                <form className="mm-chat-form" onSubmit={sendMessage}>
                  <label className="visually-hidden" htmlFor="mm-message">Message à la salle</label>
                  <input
                    id="mm-message"
                    type="text"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Écrire un message..."
                    maxLength={500}
                    autoComplete="off"
                  />
                  <button type="submit" disabled={!message.trim()} aria-label="Envoyer le message">➤</button>
                </form>
              </aside>
            </section>
          </>
        )}
      </div>

      <DeckPickerModal
        open={isDeckPickerOpen}
        decks={validDecks}
        loading={decksLoading}
        error={decksError}
        selectedDeckId={selectedDeck?.id_deck}
        onSelect={chooseDeck}
        onClose={() => setIsDeckPickerOpen(false)}
      />
    </main>
  )
}

export default Combat
