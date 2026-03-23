// db.js — JSON Database Engine (Auto-fix)

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "database.json");

function ensureDBFile() {
  // Si no existe → crearlo desde cero
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }, null, 2));
    return;
  }

  let raw = fs.readFileSync(DB_PATH, "utf8").trim();

  // Archivo vacío → regenerarlo
  if (!raw) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }, null, 2));
    return;
  }

  // Archivo corrupto → regenerarlo
  try {
    JSON.parse(raw);
  } catch {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }, null, 2));
  }
}

// Llamar al inicio
ensureDBFile();

function loadDB() {
  const raw = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(raw);
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = {
  getUser(email) {
    const db = loadDB();
    return db.users.find(u => u.email === email);
  },

  addUser(user) {
    const db = loadDB();
    db.users.push(user);
    saveDB(db);
  }
};