const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "database.json");

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }, null, 2));
  }

  const data = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(data);
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