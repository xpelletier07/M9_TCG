import pg from "pg";

// Crée une seule instance de connection partagée à la base de donnée partagée à travers tout le projet

const { Pool } = pg;

// Connexion à PostgreSQL (fournie par docker-compose via DATABASE_URL)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
