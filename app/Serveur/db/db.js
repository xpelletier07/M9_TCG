const { Pool } = require("pg");



const db = new Pool({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "TON_MOT_DE_PASSE",
    database: "TON_DATABASE"
});



export default db;