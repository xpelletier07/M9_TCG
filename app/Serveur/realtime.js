import jwt from "jsonwebtoken";
import { pool } from "./db/pool.js";
import { Server } from "socket.io";
import { attack, concede, createGame, endTurn, playCard, redactEventsFor, viewFor } from "./game/engine.js";
import { getValidDeckSummary, loadDeckCards } from "./game/deckService.js";

export function attachRealtime(server) {
	const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || true } });
	registerCombat(io.of("/combat"));
	return io;
}

// Délai pour rejoindre l'arène après le lancement ; au-delà, le joueur absent perd par déconnexion
const ARENA_JOIN_MS = 20000;

function registerCombat(io) {
	// État par salle : { started, starting, ended, playerIds, names, game, pendingEvents, introSent, timer, joinTimer }
	const roomStates = new Map();
	const disconnectTimers = new Map();

	async function broadcastRoomState(room) {
		const members = await io.in(room).fetchSockets();
		if (!members.length) return;
		const state = roomStates.get(room) || { started: false, ended: false };
		io.to(room).emit("combat:room-state", {
			players: members.map((member) => ({
				playerId: member.id,
				profile: member.data.profile,
				ready: Boolean(member.data.combatReady),
				hasDeck: Boolean(member.data.deckId),
			})),
			started: state.started,
		});
	}

	// Vue de la partie propre à un joueur + événements à animer (main/deck adverses cachés)
	function gameStatePayload(state, userId, events) {
		const opponentId = state.playerIds.find((id) => id !== userId);
		return {
			...viewFor(state.game, userId),
			myName: state.names[userId],
			opponentName: state.names[opponentId] ?? "Adversaire",
			events: redactEventsFor(events, userId),
			serverNow: Date.now(),
		};
	}

	// Envoie à chaque joueur de l'arène sa propre vue de la partie et les événements à animer
	async function emitGameState(room, state, events = []) {
		if (!state.game) return;
		const members = await io.in(room).fetchSockets();
		for (const member of members.filter((m) => m.data.combatPhase === "arena")) {
			const userId = member.data.profile.id;
			if (!state.game.players[userId]) continue;
			member.emit("combat:game-state", gameStatePayload(state, userId, events));
		}
	}

	function clearTurnTimer(state) {
		if (state.timer) clearTimeout(state.timer);
		state.timer = null;
	}

	// Fin de tour automatique quand la minuterie du joueur actif expire
	function scheduleTurnTimer(room, state) {
		clearTurnTimer(state);
		if (!state.game || state.game.winnerId !== null) return;
		const delay = Math.max(0, state.game.turnEndsAt - Date.now());
		state.timer = setTimeout(() => {
			state.timer = null;
			if (state.ended || !state.game) return;
			const result = endTurn(state.game, state.game.currentPlayerId);
			applyResult(room, state, null, result);
		}, delay);
	}

	async function finishCombat(room, state) {
		if (state.ended) return;
		state.ended = true;
		clearTurnTimer(state);
		clearTimeout(state.joinTimer);
		const { winnerId, endReason } = state.game;
		const loserId = state.playerIds.find((id) => id !== winnerId);

		try {
			await pool.query(
				"INSERT INTO combats (id_utilisateur1, id_utilisateur2, resultat) VALUES ($1, $2, $3)",
				[winnerId, loserId, `${state.names[winnerId]} gagne`]
			);
		} catch (e) {
			console.error("Erreur sauvegarde combat:", e);
		}

		const members = await io.in(room).fetchSockets();
		const arenaMembers = members.filter((m) => m.data.combatPhase === "arena");
		io.to(room).emit("combat:ended", {
			winnerId: arenaMembers.find((m) => m.data.profile.id === winnerId)?.id ?? null,
			loserId: arenaMembers.find((m) => m.data.profile.id === loserId)?.id ?? null,
			winnerUserId: winnerId,
			loserUserId: loserId,
			winnerName: state.names[winnerId] ?? "Inconnu",
			loserName: state.names[loserId] ?? "Inconnu",
			reason: endReason,
		});
	}

	// Applique le résultat d'une action du moteur : erreur à l'émetteur, sinon diffusion + minuterie / fin
	async function applyResult(room, state, socket, result) {
		if (!result.ok) {
			socket?.emit("combat:action-error", { message: result.error });
			return;
		}
		await emitGameState(room, state, result.events);
		if (state.game.winnerId !== null) {
			await finishCombat(room, state);
		} else if (result.events.some((e) => e.type === "turn")) {
			scheduleTurnTimer(room, state);
		}
	}

	// Partie en cours dans la salle du socket, si le socket est dans l'arène
	function activeGame(socket) {
		const room = socket.data.combatRoom;
		const state = roomStates.get(room);
		if (!state?.game || state.ended || socket.data.combatPhase !== "arena") return null;
		return { room, state };
	}

	async function startGame(room, state, members) {
		const decks = {};
		for (const member of members) {
			const cards = await loadDeckCards(member.data.profile.id, member.data.deckId);
			if (!cards) {
				member.data.combatReady = false;
				member.emit("combat:action-error", { message: "Ton deck n'est plus valide (cartes manquantes)." });
				return false;
			}
			decks[member.data.profile.id] = cards;
		}
		state.playerIds = members.map((m) => m.data.profile.id);
		state.names = Object.fromEntries(members.map((m) => [m.data.profile.id, m.data.profile.nom_utilisateur]));
		const { game, events } = createGame({
			playerIds: state.playerIds,
			decks,
			firstPlayerId: state.playerIds[Math.random() < 0.5 ? 0 : 1],
		});
		state.game = game;
		state.pendingEvents = events;
		state.introSent = new Set();
		state.started = true;
		scheduleTurnTimer(room, state);
		state.joinTimer = setTimeout(() => {
			const absentId = state.playerIds.find((id) => !state.introSent.has(id));
			if (absentId === undefined || state.ended) return;
			applyResult(room, state, null, concede(game, absentId, "disconnect"));
		}, ARENA_JOIN_MS);
		return true;
	}

	io.use(async (socket, next) => {
		const token = socket.handshake.auth?.token;
		if (!token) return next(new Error("Authentification requise."));
		try {
			const payload = jwt.verify(token, process.env.JWT_SECRET);
			const result = await pool.query(
				"SELECT id, nom_utilisateur, email FROM utilisateurs WHERE id = $1",
				[payload.id]
			);
			if (!result.rows[0]) return next(new Error("Utilisateur introuvable."));
			socket.data.profile = result.rows[0];
			next();
		} catch {
			next(new Error("Authentification invalide."));
		}
	});

	io.on("connection", (socket) => {
		socket.data.combatReady = false;
		socket.data.combatPhase = null;
		socket.data.combatMatchId = null;
		socket.data.deckId = null;
		socket.emit("combat:connected", { socketId: socket.id, profile: socket.data.profile });

		socket.on("combat:join", async ({ matchId = "lobby", phase = "lobby" } = {}) => {
			const normalizedMatchId = typeof matchId === "string" ? matchId.trim() : "";
			if (!normalizedMatchId || normalizedMatchId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(normalizedMatchId)) {
				socket.emit("combat:error", { message: "Code de partie invalide." });
				return;
			}

			const room = `combat:${normalizedMatchId}`;
			const currentMembers = await io.in(room).fetchSockets();
			const state = roomStates.get(room);
			const lobbyMembers = currentMembers.filter((m) => m.data.combatPhase === "lobby");

			if (phase === "arena" && (!state?.started || state.ended)) {
				socket.emit("combat:error", { message: "Cette arène n'est pas encore autorisée." });
				return;
			}
			if (phase === "arena" && !state.playerIds.includes(socket.data.profile.id)) {
				socket.emit("combat:error", { message: "Tu ne fais pas partie de ce combat." });
				return;
			}
			if (phase === "lobby" && lobbyMembers.length >= 2) {
				socket.emit("combat:error", { message: "Cette partie est complète (2 joueurs maximum)." });
				return;
			}

			if (socket.data.combatRoom && socket.data.combatRoom !== room) {
				socket.leave(socket.data.combatRoom);
			}
			if (!state || state.ended) roomStates.set(room, { started: false, ended: false });
			socket.join(room);
			socket.data.combatRoom = room;
			socket.data.combatMatchId = normalizedMatchId;
			socket.data.combatPhase = phase;
			if (phase === "arena") socket.data.combatReady = true;
			socket.emit("combat:joined", { matchId: normalizedMatchId });
			io.to(room).emit("combat:message", {
				message: `Le joueur ${socket.data.profile.nom_utilisateur} a rejoint la salle.`,
				system: true,
			});

			const currentState = roomStates.get(room);
			if (phase === "arena" && currentState?.game) {
				// La main de départ n'est animée qu'à la première arrivée du joueur dans l'arène
				const userId = socket.data.profile.id;
				const intro = currentState.introSent.has(userId) ? [] : currentState.pendingEvents;
				currentState.introSent.add(userId);
				socket.emit("combat:game-state", gameStatePayload(currentState, userId, intro));
			}

			await broadcastRoomState(room);
		});

		socket.on("combat:leave", async () => {
			const room = socket.data.combatRoom;
			if (!room) return;
			const active = activeGame(socket);
			if (active) {
				await applyResult(room, active.state, socket, concede(active.state.game, socket.data.profile.id, "leave"));
			}
			io.to(room).emit("combat:message", {
				message: `Le joueur ${socket.data.profile.nom_utilisateur} a quitté la salle.`,
				system: true,
			});
			socket.leave(room);
			socket.data.combatRoom = null;
			socket.data.combatMatchId = null;
			socket.data.combatPhase = null;
			socket.data.combatReady = false;
			socket.emit("combat:left");
			await broadcastRoomState(room);
		});

		socket.on("combat:select-deck", async ({ deckId } = {}) => {
			const room = socket.data.combatRoom;
			const state = roomStates.get(room);
			if (!room || socket.data.combatPhase !== "lobby" || state?.started || state?.starting) return;
			const id = Number(deckId);
			if (!Number.isInteger(id)) {
				socket.emit("combat:action-error", { message: "Deck invalide." });
				return;
			}
			try {
				const deck = await getValidDeckSummary(socket.data.profile.id, id);
				if (!deck) {
					socket.emit("combat:action-error", { message: "Ce deck n'est plus valide." });
					return;
				}
				socket.data.deckId = id;
				socket.data.combatReady = false;
				socket.emit("combat:deck-selected", { deck });
				await broadcastRoomState(room);
			} catch (e) {
				console.error("Erreur sélection deck:", e);
				socket.emit("combat:action-error", { message: "Erreur serveur." });
			}
		});

		socket.on("combat:ready", async ({ ready } = {}) => {
			const room = socket.data.combatRoom;
			if (!room || socket.data.combatPhase !== "lobby" || typeof ready !== "boolean") {
				socket.emit("combat:error", { message: "État Ready invalide." });
				return;
			}
			const state = roomStates.get(room) || { started: false, ended: false };
			// Pendant le lancement (chargement des decks), l'état Ready est verrouillé
			if (state.started || state.ended || state.starting) return;
			if (ready && !socket.data.deckId) {
				socket.emit("combat:action-error", { message: "Choisis un deck avant d'être prêt." });
				return;
			}
			if (ready) {
				// Le deck peut être devenu invalide depuis sa sélection (carte vendue)
				const deck = await getValidDeckSummary(socket.data.profile.id, socket.data.deckId).catch(() => null);
				if (state.started || state.starting) return;
				if (!deck) {
					socket.data.deckId = null;
					socket.data.combatReady = false;
					socket.emit("combat:deck-selected", { deck: null });
					socket.emit("combat:action-error", { message: "Ton deck n'est plus valide (cartes manquantes)." });
					await broadcastRoomState(room);
					return;
				}
			}
			socket.data.combatReady = ready;
			roomStates.set(room, state);
			const members = (await io.in(room).fetchSockets()).filter((m) => m.data.combatPhase === "lobby");
			if (members.length === 2 && members.every((m) => m.data.combatReady) && !state.starting && !state.started) {
				state.starting = true;
				try {
					await startGame(room, state, members);
				} catch (e) {
					console.error("Erreur lancement combat:", e);
					members.forEach((m) => { m.data.combatReady = false; });
					io.to(room).emit("combat:action-error", { message: "Impossible de lancer la partie." });
				} finally {
					state.starting = false;
				}
			}
			if (state.started) io.to(room).emit("combat:started");
			await broadcastRoomState(room);
		});

		socket.on("combat:play-card", async ({ instanceId } = {}) => {
			const active = activeGame(socket);
			if (!active) return;
			await applyResult(active.room, active.state, socket, playCard(active.state.game, socket.data.profile.id, instanceId));
		});

		socket.on("combat:attack", async ({ attackerInstanceId, target } = {}) => {
			const active = activeGame(socket);
			if (!active) return;
			await applyResult(active.room, active.state, socket, attack(active.state.game, socket.data.profile.id, attackerInstanceId, target));
		});

		socket.on("combat:end-turn", async () => {
			const active = activeGame(socket);
			if (!active) return;
			await applyResult(active.room, active.state, socket, endTurn(active.state.game, socket.data.profile.id));
		});

		socket.on("combat:message", ({ message } = {}) => {
			const room = socket.data.combatRoom;
			if (!room || typeof message !== "string" || !message.trim() || message.length > 500) {
				socket.emit("combat:error", { message: "Message de combat invalide." });
				return;
			}
			io.to(room).emit("combat:message", {
				playerId: socket.id,
				playerName: socket.data.profile.nom_utilisateur,
				message: message.trim(),
			});
		});

		socket.on("disconnect", () => {
			const room = socket.data.combatRoom;
			if (!room || socket.data.combatPhase !== "arena") return;
			// On retient la partie en cours : une nouvelle partie dans la même salle ne doit pas être touchée
			const game = roomStates.get(room)?.game;

			const timer = setTimeout(async () => {
				disconnectTimers.delete(socket.data.profile.id);
				const state = roomStates.get(room);
				if (state?.game && state.game === game && !state.ended) {
					await applyResult(room, state, null, concede(state.game, socket.data.profile.id, "disconnect"));
				}
				io.to(room).emit("combat:message", {
					message: `Le joueur ${socket.data.profile.nom_utilisateur} s'est déconnecté.`,
					system: true,
				});
				broadcastRoomState(room);
			}, 5000);
			disconnectTimers.set(socket.data.profile.id, timer);
		});
	});
}

export default attachRealtime;
