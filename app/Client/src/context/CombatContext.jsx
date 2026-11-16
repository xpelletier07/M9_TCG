import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { API_BASE_URL } from '../config'

const CombatContext = createContext(null)

// Garde la connexion socket (et donc la salle d'attente) vivante pendant que le joueur navigue entre les pages.
export function CombatProvider({ children }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const joinedMatchRef = useRef(null)
  const [connectionStatus, setConnectionStatus] = useState('Connexion...')
  const [notice, setNotice] = useState('')
  const [joinedMatchId, setJoinedMatchId] = useState(null)
  const [socketId, setSocketId] = useState(null)
  const [players, setPlayers] = useState([])
  const [combatStarted, setCombatStarted] = useState(false)
  const [lobbies, setLobbies] = useState([])
  const [messages, setMessages] = useState([])
  const [roomIsPrivate, setRoomIsPrivate] = useState(false)

  useEffect(() => {
    if (!token) return undefined

    const socket = io(`${API_BASE_URL}/combat`, { autoConnect: false, auth: { token } })
    socketRef.current = socket

    function resetRoom() {
      joinedMatchRef.current = null
      setJoinedMatchId(null)
      setPlayers([])
      setCombatStarted(false)
      setMessages([])
      setRoomIsPrivate(false)
    }

    socket.on('connect', () => {
      setConnectionStatus('Connecté')
      socket.emit('combat:lobbies')
    })
    socket.on('disconnect', () => {
      setConnectionStatus('Déconnecté')
      setSocketId(null)
      resetRoom()
    })
    socket.on('connect_error', () => setConnectionStatus('Serveur indisponible'))
    socket.on('combat:connected', ({ socketId: id }) => setSocketId(id))
    socket.on('combat:lobbies', ({ lobbies: list }) => setLobbies(list))
    socket.on('combat:joined', ({ matchId, isPrivate }) => {
      joinedMatchRef.current = matchId
      setRoomIsPrivate(Boolean(isPrivate))
      setJoinedMatchId(matchId)
      setCombatStarted(false)
      setNotice('')
    })
    socket.on('combat:left', () => {
      resetRoom()
      socket.emit('combat:lobbies')
    })
    socket.on('combat:room-state', ({ players: roomPlayers, started }) => {
      setPlayers(roomPlayers)
      setCombatStarted(started)
    })
    socket.on('combat:started', () => {
      const matchId = joinedMatchRef.current
      if (!matchId) return
      navigate(`/combat/${matchId}/arena`)
      // La salle d'attente se termine : on libère la connexion avant que l'arène ne prenne le relais.
      resetRoom()
      socket.disconnect()
      socket.connect()
    })
    socket.on('combat:message', ({ playerId, playerName, message, system }) => {
      setMessages((current) => [...current, { playerId, playerName, message, system }].slice(-60))
    })
    socket.on('combat:error', ({ message }) => setNotice(message))

    socket.connect()

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, navigate])

  const isOnline = connectionStatus === 'Connecté'

  const joinMatch = useCallback((matchId, isPrivate = false) => {
    if (!isOnline || joinedMatchRef.current) return
    setNotice('')
    socketRef.current?.emit('combat:join', { matchId, phase: 'lobby', isPrivate })
  }, [isOnline])

  const leaveMatch = useCallback(() => {
    socketRef.current?.emit('combat:leave')
  }, [])

  const toggleReady = useCallback(() => {
    const me = players.find((player) => player.playerId === socketId)
    if (players.length !== 2 || combatStarted) return
    socketRef.current?.emit('combat:ready', { ready: !me?.ready })
  }, [players, socketId, combatStarted])

  const sendMessage = useCallback((text) => {
    socketRef.current?.emit('combat:message', { message: text })
  }, [])

  const value = useMemo(() => ({
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
    joinMatch,
    leaveMatch,
    toggleReady,
    sendMessage,
  }), [connectionStatus, notice, joinedMatchId, socketId, players, combatStarted, lobbies, messages, roomIsPrivate, joinMatch, leaveMatch, toggleReady, sendMessage])

  return <CombatContext.Provider value={value}>{children}</CombatContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCombat() {
  const context = useContext(CombatContext)
  if (!context) throw new Error('useCombat doit être utilisé dans un CombatProvider')
  return context
}
