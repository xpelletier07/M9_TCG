import jwt from "jsonwebtoken";
import { pool } from "./db/pool.js";
import { Server } from "socket.io";

export function attachRealtime(server) {
	const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || true } });
	registerCombat(io.of("/combat"));
	return io;
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

	async function endCombat(room, loserId, reason, loserName) {
		const state = roomStates.get(room);
		if (!state || !state.started || state.ended) return false;
		const members = await io.in(room).fetchSockets();
		const winner = members.find((member) => member.id !== loserId);
		if (!winner) return false;
		state.ended = true;
		roomStates.set(room, state);
		io.to(room).emit("combat:ended", {
			winnerId: winner.id,
			loserId,
			winnerName: winner.data.profile.nom_utilisateur,
			loserName,
			reason,
		});
		return true;
	}

	io.use(async (socket, next) => {
		const token = socket.handshake.auth?.token;
		if (!token) return next(new Error("Authentification requise."));
		try {
			const payload = jwt.verify(token, process.env.JWT_SECRET);
			const result = await pool.query(
				"SELECT id, nom_utilisateur, email FROM utilisateurs WHERE id = $1",
				[payload.id],
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
			const lobbyMembers = currentMembers.filter((member) => member.data.combatPhase === "lobby");

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
			await broadcastRoomState(room);
		});

		socket.on("combat:leave", async () => {
			const room = socket.data.combatRoom;
			if (!room) return;
			if (socket.data.combatPhase === "arena") {
				await endCombat(room, socket.id, "leave", socket.data.profile.nom_utilisateur);
			}
			io.to(room).emit("combat:message", { message: `Le joueur ${socket.data.profile.nom_utilisateur} a quitté la salle.`, system: true });
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
			const members = (await io.in(room).fetchSockets()).filter((member) => member.data.combatPhase === "lobby");
			if (members.length === 2 && members.every((member) => member.data.combatReady)) {
				state.started = true;
				state.playerIds = members.map((member) => member.data.profile.id);
			}
			roomStates.set(room, state);
			if (state.started) io.to(room).emit("combat:started");
			await broadcastRoomState(room);
		});

		socket.on("combat:action", ({ matchId = "lobby", action, data } = {}) => {
			const room = `combat:${matchId}`;
			if (socket.data.combatRoom !== room || typeof action !== "string") {
				socket.emit("combat:error", { message: "Action de combat invalide." });
				return;
			}
			socket.to(room).emit("combat:action", { playerId: socket.id, playerName: socket.data.profile.nom_utilisateur, action, data });
		});

		socket.on("combat:message", ({ message } = {}) => {
			const room = socket.data.combatRoom;
			if (!room || typeof message !== "string" || !message.trim() || message.length > 500) {
				socket.emit("combat:error", { message: "Message de combat invalide." });
				return;
			}
			io.to(room).emit("combat:message", { playerId: socket.id, playerName: socket.data.profile.nom_utilisateur, message: message.trim() });
		});

		socket.on("disconnect", () => {
			const room = socket.data.combatRoom;
			if (!room || socket.data.combatPhase !== "arena") return;

			const timer = setTimeout(() => {
				disconnectTimers.delete(socket.data.profile.id);
				endCombat(room, socket.id, "disconnect", socket.data.profile.nom_utilisateur);
				io.to(room).emit("combat:message", { message: `Le joueur ${socket.data.profile.nom_utilisateur} s'est déconnecté.`, system: true });
				broadcastRoomState(room);
			}, 5000);
			disconnectTimers.set(socket.data.profile.id, timer);
		});
	});
}

export default attachRealtime;
