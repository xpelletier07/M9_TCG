import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;

// Connexion à PostgreSQL (fournie par docker-compose via DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

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