const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbFile = process.env.DB_FILE || path.join(__dirname, "..", "data", "internships.db");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables if they do not exist yet.
db.exec(fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8"));

module.exports = db;
