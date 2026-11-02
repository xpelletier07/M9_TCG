import jwt from "jsonwebtoken";
import { pool } from "./db/pool.js";
import { Server } from "socket.io";

export function attachRealtime(server) {
	const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || true } });
	registerCombat(io.of("/combat"));
	return io;
}

function shuffle(array) {
	const arr = [...array];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

async function loadDeck(userId) {
	const { rows } = await pool.query(
		`SELECT c.id_carte, c.nom_carte, c.image, c.description, c.rarete, c.mana, c.health, c.damage, ic.quantite
		 FROM inventaire_carte ic
		 JOIN carte c ON ic.id_carte = c.id_carte
		 WHERE ic.id_utilisateur = $1`,
		[userId]
	);
	const cards = [];
	let counter = 0;
	for (const row of rows) {
		for (let i = 0; i < row.quantite; i++) {
			cards.push({
				id_carte: row.id_carte,
				nom_carte: row.nom_carte,
				image: row.image,
				description: row.description,
				rarete: row.rarete,
				mana: row.mana,
				health: row.health,
				damage: row.damage,
				instanceId: `${userId}-${row.id_carte}-${counter++}`,
			});
		}
	}
	return shuffle(cards).slice(0, 50);
}

function registerCombat(io) {
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
			})),
			started: state.started,
		});
	}

	async function emitGameState(room, state) {
		if (!state.gameState) return;
		const members = await io.in(room).fetchSockets();
		const arenaMembers = members.filter((m) => m.data.combatPhase === "arena");
		const gs = state.gameState;

		for (const member of arenaMembers) {
			const userId = member.data.profile.id;
			const myPlayer = gs.players[userId];
			if (!myPlayer) continue;
			const opponentUserId = state.playerIds.find((id) => id !== userId);
			const opponentPlayer = gs.players[opponentUserId];
			if (!opponentPlayer) continue;
			const opponentMember = arenaMembers.find((m) => m.data.profile.id === opponentUserId);

			member.emit("combat:game-state", {
				turn: gs.turn,
				currentTurnUserId: gs.currentTurnUserId,
				isMyTurn: gs.currentTurnUserId === userId,
				myUserId: userId,
				myName: member.data.profile.nom_utilisateur,
				opponentName: opponentMember?.data.profile.nom_utilisateur ?? "Adversaire",
				myState: {
					hp: myPlayer.hp,
					mana: myPlayer.mana,
					maxMana: myPlayer.maxMana,
					hand: myPlayer.hand,
					board: myPlayer.board,
					deckCount: myPlayer.deck.length,
				},
				opponentState: {
					userId: opponentUserId,
					hp: opponentPlayer.hp,
					mana: opponentPlayer.mana,
					maxMana: opponentPlayer.maxMana,
					handCount: opponentPlayer.hand.length,
					board: opponentPlayer.board,
					deckCount: opponentPlayer.deck.length,
				},
			});
		}
	}

	async function initGameState(state) {
		const gs = { turn: 1, players: {} };

		for (const userId of state.playerIds) {
			const deck = await loadDeck(userId);
			const hand = deck.splice(0, 3);
			gs.players[userId] = { hp: 50, mana: 0, maxMana: 0, turnCount: 0, deck, hand, board: [] };
		}

		const firstUserId = state.playerIds[Math.random() < 0.5 ? 0 : 1];
		gs.currentTurnUserId = firstUserId;

		const firstPlayer = gs.players[firstUserId];
		firstPlayer.turnCount = 1;
		firstPlayer.maxMana = 1;
		firstPlayer.mana = 1;
		if (firstPlayer.deck.length > 0) firstPlayer.hand.push(firstPlayer.deck.shift());

		state.gameState = gs;
	}

	async function endCombat(room, loserSocketId, reason, loserName) {
		const state = roomStates.get(room);
		if (!state || !state.started || state.ended) return false;
		state.ended = true;
		roomStates.set(room, state);

		const members = await io.in(room).fetchSockets();
		const arenaMembers = members.filter((m) => m.data.combatPhase === "arena");
		const loserSocket = arenaMembers.find((m) => m.id === loserSocketId);
		const winnerSocket = arenaMembers.find((m) => m.id !== loserSocketId);

		if (winnerSocket && loserSocket) {
			try {
				await pool.query(
					"INSERT INTO combats (id_utilisateur1, id_utilisateur2, resultat) VALUES ($1, $2, $3)",
					[winnerSocket.data.profile.id, loserSocket.data.profile.id, `${winnerSocket.data.profile.nom_utilisateur} gagne`]
				);
			} catch (e) {
				console.error("Erreur sauvegarde combat:", e);
			}
		}

		io.to(room).emit("combat:ended", {
			winnerId: winnerSocket?.id ?? null,
			loserId: loserSocketId,
			winnerName: winnerSocket?.data.profile.nom_utilisateur ?? "Inconnu",
			loserName,
			reason,
		});
		return true;
	}

	async function endCombatByUserId(room, loserUserId, reason) {
		const state = roomStates.get(room);
		if (!state || !state.started || state.ended) return false;
		const members = await io.in(room).fetchSockets();
		const loserSocket = members.find(
			(m) => m.data.profile.id === loserUserId && m.data.combatPhase === "arena"
		);
		if (!loserSocket) return false;
		return endCombat(room, loserSocket.id, reason, loserSocket.data.profile.nom_utilisateur);
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
			if (phase === "arena" && currentState?.gameState) {
				await emitGameState(room, currentState);
			}

			await broadcastRoomState(room);
		});

		socket.on("combat:leave", async () => {
			const room = socket.data.combatRoom;
			if (!room) return;
			if (socket.data.combatPhase === "arena") {
				await endCombat(room, socket.id, "leave", socket.data.profile.nom_utilisateur);
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

		socket.on("combat:ready", async ({ ready } = {}) => {
			const room = socket.data.combatRoom;
			if (!room || socket.data.combatPhase !== "lobby" || typeof ready !== "boolean") {
				socket.emit("combat:error", { message: "État Ready invalide." });
				return;
			}
			const state = roomStates.get(room) || { started: false, ended: false };
			if (state.started || state.ended) return;
			socket.data.combatReady = ready;
			const members = (await io.in(room).fetchSockets()).filter((m) => m.data.combatPhase === "lobby");
			if (members.length === 2 && members.every((m) => m.data.combatReady)) {
				state.started = true;
				state.playerIds = members.map((m) => m.data.profile.id);
				await initGameState(state);
			}
			roomStates.set(room, state);
			if (state.started) io.to(room).emit("combat:started");
			await broadcastRoomState(room);
		});

		socket.on("combat:play-card", async ({ instanceId } = {}) => {
			const room = socket.data.combatRoom;
			const state = roomStates.get(room);
			if (!state?.gameState || state.ended || socket.data.combatPhase !== "arena") return;
			const gs = state.gameState;
			const userId = socket.data.profile.id;
			if (gs.currentTurnUserId !== userId) {
				socket.emit("combat:error", { message: "Ce n'est pas ton tour." });
				return;
			}
			const player = gs.players[userId];
			const cardIdx = player.hand.findIndex((c) => c.instanceId === instanceId);
			if (cardIdx === -1) {
				socket.emit("combat:error", { message: "Carte introuvable." });
				return;
			}
			const card = player.hand[cardIdx];
			if (card.mana > player.mana) {
				socket.emit("combat:error", { message: "Pas assez de mana." });
				return;
			}
			player.mana -= card.mana;
			player.hand.splice(cardIdx, 1);
			player.board.push({ ...card, currentHp: card.health, canAttack: false });
			roomStates.set(room, state);
			await emitGameState(room, state);
		});

		socket.on("combat:attack", async ({ attackerInstanceId, targetType, targetInstanceId } = {}) => {
			const room = socket.data.combatRoom;
			const state = roomStates.get(room);
			if (!state?.gameState || state.ended || socket.data.combatPhase !== "arena") return;
			const gs = state.gameState;
			const userId = socket.data.profile.id;
			if (gs.currentTurnUserId !== userId) return;

			const player = gs.players[userId];
			const opponentUserId = state.playerIds.find((id) => id !== userId);
			const opponent = gs.players[opponentUserId];

			const attacker = player.board.find((c) => c.instanceId === attackerInstanceId);
			if (!attacker?.canAttack) {
				socket.emit("combat:error", { message: "Cette carte ne peut pas attaquer." });
				return;
			}
			attacker.canAttack = false;

			if (targetType === "player") {
				opponent.hp = Math.max(0, opponent.hp - attacker.damage);
				if (opponent.hp === 0) {
					roomStates.set(room, state);
					await emitGameState(room, state);
					await endCombatByUserId(room, opponentUserId, "combat");
					return;
				}
			} else if (targetType === "card") {
				const targetIdx = opponent.board.findIndex((c) => c.instanceId === targetInstanceId);
				if (targetIdx === -1) return;
				const target = opponent.board[targetIdx];
				target.currentHp -= attacker.damage;
				attacker.currentHp -= target.damage;
				if (target.currentHp <= 0) opponent.board.splice(targetIdx, 1);
				const attackerIdx = player.board.findIndex((c) => c.instanceId === attackerInstanceId);
				if (attacker.currentHp <= 0 && attackerIdx !== -1) player.board.splice(attackerIdx, 1);
			}

			roomStates.set(room, state);
			await emitGameState(room, state);
		});

		socket.on("combat:end-turn", async () => {
			const room = socket.data.combatRoom;
			const state = roomStates.get(room);
			if (!state?.gameState || state.ended || socket.data.combatPhase !== "arena") return;
			const gs = state.gameState;
			const userId = socket.data.profile.id;
			if (gs.currentTurnUserId !== userId) return;

			const opponentUserId = state.playerIds.find((id) => id !== userId);
			const opponent = gs.players[opponentUserId];

			gs.currentTurnUserId = opponentUserId;
			gs.turn += 1;

			opponent.turnCount = (opponent.turnCount || 0) + 1;
			opponent.maxMana = Math.min(10, opponent.turnCount);
			opponent.mana = opponent.maxMana;
			opponent.board.forEach((card) => { card.canAttack = true; });

			if (opponent.deck.length === 0) {
				roomStates.set(room, state);
				await emitGameState(room, state);
				await endCombatByUserId(room, opponentUserId, "fatigue");
				return;
			}
			opponent.hand.push(opponent.deck.shift());

			roomStates.set(room, state);
			await emitGameState(room, state);
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

			const timer = setTimeout(() => {
				disconnectTimers.delete(socket.data.profile.id);
				endCombat(room, socket.id, "disconnect", socket.data.profile.nom_utilisateur);
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
