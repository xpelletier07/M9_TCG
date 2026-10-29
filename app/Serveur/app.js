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
    console.error("Erreur de connexion à la  base de données :", err);
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


async function startServer() {
  // Migration pour les bases existantes (db.sql ne s'exécute qu'à la création du volume) : support de la connexion GitHub
  await pool.query(`
    ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS github_id VARCHAR(50) UNIQUE;
    ALTER TABLE utilisateurs ALTER COLUMN mot_de_passe_hash DROP NOT NULL;
    ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS dernier_claim_carte_at TIMESTAMPTZ;
  `)

  // Insert des comptes de démonstration si ils n'existent pas déjà
  await pool.query(`
    INSERT INTO utilisateurs
      (nom_utilisateur, email, mot_de_passe_hash, statut, credits)
    VALUES
      ('demo-joueur', 'joueur.demo@m9tcg.local', '$2b$10$uWXDSzG.Ij2gErVSwwgQl.Q23..Jyoc48IAbbeVMEVGlVHMj.TdWC', 'actif', 1000),
      ('demo-admin', 'admin.demo@m9tcg.local', '$2b$10$8HEhcGOoGh.LR6EAev7.y.sLy7AQ5TpAI/d/fTz2W896Y8FkwRopG' , 'admin', 1000)
    ON CONFLICT DO NOTHING
  `)

  // Insertion des cartes de démonstration si elles n'existent pas déjà
  await pool.query(`
    INSERT INTO carte
      (nom_carte, image, description, rarete, valeur, mana, health, damage)
    VALUES
      ('Peak', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTWKCFnan-Xyw5qJBLOFr-r5ZSFjv6a3pSNCOkjPlN7aw&s=10', 'Trop bien', 4, 10, 10, 100, 30),
      ('Cold', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQUoTXPh-uMj39OaszhWUMJRwYkL09XQtTEP_d6jh0vwQ&s=10', 'Cat that comes from hell', 3, 20, 2, 60, 20),
      ('Random guy', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-3bPUxf-ZXRskRiuyV1jjr8EsYRc-MCFbJRzpv8ITAg&s=10', 'he is a random guy', 1, 10, 1, 25, 13),
      ('Random guy 2', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-3bPUxf-ZXRskRiuyV1jjr8EsYRc-MCFbJRzpv8ITAg&s=10', 'he is a random guy2', 2, 10, 1, 25, 14),
      ('Belle Province hot-dog PEAK', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQA97YcZ3a_MmZJPxdMwTVVOiJTtlg09alpavTO69vqaA&s=10', '4 steamés all dressed pour 9.15$ le lundi', 4, 100, 10, 250, 150)
    ON CONFLICT DO NOTHING
  `)

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })
}

startServer().catch((error) => {
  console.error("Erreur lors de la préparation de la base de données :", error)
  process.exit(1)
})