import express from "express";
import cors from "cors";
import { pool } from "./db/pool.js"
import collectionRouter from "./routes/collection.js"

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Importation des routes
app.use("/collection", collectionRouter)

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});