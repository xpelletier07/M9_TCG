import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db/pool.js"
<<<<<<< HEAD
import collectionRouter from "./routes/collection.js";
import packsRouter from "./routes/Packs.js";
import checkAuth from "./routes/auth.js"
import inventairePackRouter from "./routes/inventairePack.js"
=======
import apiRouter from "./Router/Router_Global.js"
>>>>>>> 8233dbb87b5abf634264e1a73492da7263e8eafc

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Importation des routes
<<<<<<< HEAD
app.use("/collection", collectionRouter)
app.use("/pack", packsRouter)
app.use("/auth", checkAuth)
app.use("/inventaire-pack", inventairePackRouter)
=======
app.use(apiRouter)
>>>>>>> 8233dbb87b5abf634264e1a73492da7263e8eafc

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
  await pool.query(
    "ALTER TABLE Packs ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT TRUE"
  )
  await pool.query(
    "ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS dernier_drop_pack_at TIMESTAMPTZ"
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS inventaire_packs (
      id_utilisateur int references utilisateurs(id) on delete cascade,
      id_pack int references Packs(id_pack) on delete cascade,
      quantite int not null default 1,
      primary key (id_utilisateur, id_pack)
    )`
  )

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })
}

startServer().catch((error) => {
  console.error("Erreur lors de la préparation de la base de données :", error)
  process.exit(1)
})