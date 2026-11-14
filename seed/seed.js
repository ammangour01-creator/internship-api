// Run with: npm run seed
// Safe to run many times: existing IDs are skipped.
const fs = require("fs");
const path = require("path");
const db = require("../src/db");

// 1) Records from the supplied SQL sample (INT-001 .. INT-004)
db.exec(fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8"));

// 2) Records from the supplied JSON seed (INT-101 .. INT-105)
const json = JSON.parse(fs.readFileSync(path.join(__dirname, "internships.json"), "utf8"));

const insert = db.prepare(`
  INSERT OR IGNORE INTO internships
    (id, title, domain, mode, location, skills, openings, duration_weeks, applications_open)
  VALUES (@id, @title, @domain, @mode, @location, @skills, @openings, @duration_weeks, @applications_open)
`);

const insertMany = db.transaction((rows) => {
  for (const r of rows) {
    insert.run({
      id: r.id,
      title: r.title,
      domain: r.domain,
      mode: r.mode,
      location: r.location || "",
      skills: JSON.stringify(r.skills || []),
      openings: Number.isInteger(r.openings) ? r.openings : 1,
      duration_weeks: Number.isInteger(r.duration_weeks) ? r.duration_weeks : 4,
      applications_open: r.applications_open === 0 ? 0 : 1,
    });
  }
});

insertMany(json.internships);

const { total } = db.prepare("SELECT COUNT(*) AS total FROM internships").get();
console.log(`Seed complete. internships table now has ${total} records.`);
