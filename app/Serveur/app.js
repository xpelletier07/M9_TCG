import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db/pool.js"
import apiRouter from "./Router/Router_Global.js"

const app = express();
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
  // Insert des comptes de démonstration si ils n'existent pas déjà
  await pool.query(`
    INSERT INTO utilisateurs
      (nom_utilisateur, email, mot_de_passe_hash, statut, credits)
    VALUES
      ('demo-joueur', 'joueur.demo@m9tcg.local', '$2b$10$uWXDSzG.Ij2gErVSwwgQl.Q23..Jyoc48IAbbeVMEVGlVHMj.TdWC', 'actif', 1000),
      ('demo-admin', 'admin.demo@m9tcg.local', '$2b$10$8HEhcGOoGh.LR6EAev7.y.sLy7AQ5TpAI/d/fTz2W896Y8FkwRopG', 'admin', 1000)
    ON CONFLICT DO NOTHING
  `)

  // Insertion des cartes de démonstration si elles n'existent pas déjà
  await pool.query(`
    INSERT INTO carte
      (nom_carte, image, description, rarete, valeur, mana, health, damage)
    VALUES
      ('Carte Démo 1', 'https://picsum.photos/400/280?random=89', 'Description de la carte démo 1', 1, 10, 1, 5, 2),
      ('Carte Démo 2', 'https://picsum.photos/400/280?random=90', 'Description de la carte démo 2', 2, 20, 2, 10, 4),
      ('Carte Démo 3', 'https://picsum.photos/400/280?random=91', 'Description de la carte démo 3', 3, 30, 3, 15, 6)
    ON CONFLICT DO NOTHING
  `)

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })
}

startServer().catch((error) => {
  console.error("Erreur lors de la préparation de la base de données :", error)
  process.exit(1)
})