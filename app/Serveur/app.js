import "dotenv/config";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { pool } from "./db/pool.js"
import apiRouter from "./Router/Router_Global.js"
import attachRealtime from "./realtime.js"
import jwt from "jsonwebtoken"
import { getConnectedUsersCount, recordUserActivity, setDropCommunIo } from "./services/dropCommunService.js"

const app = express();
const server = createServer(app);
const io = attachRealtime(server);
setDropCommunIo(io);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Importation des routes
app.use(apiRouter)

// Route de base
app.get("/", (req, res) => {
  res.json({ message: "M9 TCG API en ligne" });
});

// Route de santé simple (utilisée par le CI / healthchecks)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Route qui vérifie que la connexion à la base de données fonctionne
app.get("/api/db-check", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");
    res.json({ db: "connected", time: result.rows[0].current_time });
  } catch (err) {
    console.error("Erreur de connexion à la base de données :", err);
    res.status(500).json({ db: "error", message: err.message });
  }
});

app.get('/api/online-users', (req, res) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1]
      const decoded = jwt.decode(token)
      if (decoded?.id) {
        recordUserActivity(decoded.id)
      }
    } catch {
      // ignore token decode errors
    }
  }

  const activeCount = getConnectedUsersCount()
  const socketCount = io.engine?.clientsCount || 0
  res.json({ connectedUsers: Math.max(activeCount, socketCount) })
})

app.get("/api/drop-timer", (req, res) => {
  const cycleSeconds = 5 * 60
  const nowSeconds = Math.floor(Date.now() / 1000)
  const remainingSeconds = cycleSeconds - (nowSeconds % cycleSeconds)
  const resetAt = new Date((nowSeconds + remainingSeconds) * 1000).toISOString()

  res.json({
    cycleSeconds,
    remainingSeconds,
    resetAt,
  })
})

// Les données de démonstration (comptes, cartes) sont insérées par db/seed.sql,
// exécuté par PostgreSQL uniquement à la création initiale de la base de données.
// Important : écouter sur `server` (et non `app`) pour que socket.io reçoive les connexions.
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})