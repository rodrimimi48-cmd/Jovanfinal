const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database.db");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al conectar SQLite:", err);
    } else {
        console.log("SQLite conectado:", dbPath);
    }
});

module.exports = db;