import { Server } from "socket.io";



export function attachRealtime(server) {
	const io = new Server(server, {
		cors: { origin: process.env.CLIENT_URL || true },
	});

	registerCombat(io.of("/combat"));

	return io;
}

function registerCombat(io) {
	const roomStates = new Map();

	async function broadcastRoomState(room) {
		const members = await io.in(room).fetchSockets();
		if (!members.length) {
			roomStates.delete(room);
			return;
		}

		const state = roomStates.get(room) || { started: false };
		io.to(room).emit("combat:room-state", {
			players: members.map((member) => ({
				playerId: member.id,
				ready: Boolean(member.data.combatReady),
			})),
			started: state.started,
		});
	}

	io.on("connection", (socket) => {
		socket.data.combatReady = false;
		socket.emit("combat:connected", { socketId: socket.id });

		console.log(`Socket connecté : ${socket.id}`);

		socket.on("combat:join", async ({ matchId = "lobby" } = {}) => {
			const normalizedMatchId = typeof matchId === "string" ? matchId.trim() : "";
			if (!normalizedMatchId || normalizedMatchId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(normalizedMatchId)) {
				socket.emit("combat:error", { message: "Code de partie invalide." });
				return;
			}

			const room = `combat:${normalizedMatchId}`;
			const currentMembers = await io.in(room).fetchSockets();
			if (!currentMembers.some((member) => member.id === socket.id) && currentMembers.length >= 2) {
				socket.emit("combat:error", { message: "Cette partie est complète (2 joueurs maximum)." });
				return;
			}

			if (socket.data.combatRoom) {
				socket.leave(socket.data.combatRoom);
				await broadcastRoomState(socket.data.combatRoom);
			}

			if (!roomStates.has(room)) roomStates.set(room, { started: false });
			socket.join(room);
			socket.data.combatRoom = room;
			socket.data.combatReady = false;
			socket.emit("combat:joined", { matchId: normalizedMatchId });
			socket.to(room).emit("combat:player-joined", { playerId: socket.id });
			io.to(room).emit("combat:message", {
				message: `Le joueur ${socket.id} a rejoint la salle.`,
				system: true,
			});
			await broadcastRoomState(room);
		});

		socket.on("combat:leave", async () => {
			if (!socket.data.combatRoom) return;

			const room = socket.data.combatRoom;
			io.to(room).emit("combat:message", {
				message: `Le joueur ${socket.id} a quitté la salle.`,
				system: true,
			});
			socket.leave(room);
			socket.data.combatRoom = null;
			socket.data.combatReady = false;
			socket.to(room).emit("combat:player-left", { playerId: socket.id, reason: "left" });
			socket.emit("combat:left");
			await broadcastRoomState(room);
		});

		socket.on("combat:ready", async ({ ready } = {}) => {
			const room = socket.data.combatRoom;
			if (!room || typeof ready !== "boolean") {
				socket.emit("combat:error", { message: "État Ready invalide." });
				return;
			}

			const state = roomStates.get(room) || { started: false };
			if (state.started) return;

			socket.data.combatReady = ready;
			const members = await io.in(room).fetchSockets();
			if (members.length === 2 && members.every((member) => member.data.combatReady)) {
				state.started = true;
				io.to(room).emit("combat:started");
			}
			roomStates.set(room, state);
			await broadcastRoomState(room);
		});

		socket.on("combat:action", ({ matchId = "lobby", action, data } = {}) => {
			const room = `combat:${matchId}`;
			if (socket.data.combatRoom !== room || typeof action !== "string") {
				socket.emit("combat:error", { message: "Action de combat invalide." });
				return;
			}
			socket.to(room).emit("combat:action", { playerId: socket.id, action, data });
		});

		socket.on("combat:message", ({ message } = {}) => {
			const room = socket.data.combatRoom;
			if (!room || typeof message !== "string" || !message.trim() || message.length > 500) {
				socket.emit("combat:error", { message: "Message de combat invalide." });
				return;
			}

			io.to(room).emit("combat:message", {
				playerId: socket.id,
				message: message.trim(),
			});
		});

		socket.on("disconnect", () => {
			if (socket.data.combatRoom) {
				const room = socket.data.combatRoom;
				console.log(`Socket déconnecté : ${socket.id} de ${room}`);
				socket.to(room).emit("combat:player-left", { playerId: socket.id, reason: "disconnect" });
				io.to(room).emit("combat:message", {
					message: `Le joueur ${socket.id} s'est déconnecté.`,
					system: true,
				});
				broadcastRoomState(room);
			}
		});
	});
}

export default attachRealtime;


