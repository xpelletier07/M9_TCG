import { Server } from "socket.io";



export function attachRealtime(server) {
	const io = new Server(server, {
		cors: { origin: process.env.CLIENT_URL || true },
	});

	registerCombat(io);

	return io;
}

function registerCombat(io) {
	io.on("connection", (socket) => {
		socket.emit("combat:connected", { socketId: socket.id });

		console.log(`Socket connecté : ${socket.id}`);

		socket.on("combat:join", ({ matchId = "lobby" } = {}) => {
			const normalizedMatchId = typeof matchId === "string" ? matchId.trim() : "";
			if (!normalizedMatchId || normalizedMatchId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(normalizedMatchId)) {
				socket.emit("combat:error", { message: "Code de partie invalide." });
				return;
			}

			if (socket.data.combatRoom) {
				socket.leave(socket.data.combatRoom);
			}

			const room = `combat:${normalizedMatchId}`;
			socket.join(room);
			socket.data.combatRoom = room;
			socket.emit("combat:joined", { matchId: normalizedMatchId });
			socket.to(room).emit("combat:player-joined", { playerId: socket.id });
			io.to(room).emit("combat:message", {
				message: `Le joueur ${socket.id} a rejoint la salle.`,
				system: true,
			});
		});

		socket.on("combat:leave", () => {
			if (!socket.data.combatRoom) return;

			const room = socket.data.combatRoom;
			io.to(room).emit("combat:message", {
				message: `Le joueur ${socket.id} a quitté la salle.`,
				system: true,
			});
			socket.leave(room);
			socket.data.combatRoom = null;
			socket.to(room).emit("combat:player-left", { playerId: socket.id, reason: "left" });
			socket.emit("combat:left");
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
				console.log(`Socket déconnecté : ${socket.id} de ${socket.data.combatRoom}`);
				socket.to(socket.data.combatRoom).emit("combat:player-left", { playerId: socket.id, reason: "disconnect" });
			}
		});
	});
}

export default attachRealtime;



