const express = require("express");
const db = require("./db");
const { validateInternship, parsePagination, MODES } = require("./validate");

const app = express();
app.use(express.json({ limit: "10kb" }));

// ---------- helpers: one response format for everything ----------
function ok(res, data, extra = {}, code = 200) {
  return res.status(code).json({ status: "success", data, ...extra });
}

function fail(res, code, errorCode, message, details) {
  const error = { code: errorCode, message };
  if (details) error.details = details;
  return res.status(code).json({ status: "error", error });
}

function toRecord(row) {
  return {
    id: row.id,
    title: row.title,
    domain: row.domain,
    mode: row.mode,
    location: row.location,
    skills: JSON.parse(row.skills),
    openings: row.openings,
    duration_weeks: row.duration_weeks,
    applications_open: row.applications_open === 1,
  };
}

function nextId() {
  const row = db
    .prepare("SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) AS max FROM internships")
    .get();
  return "INT-" + String((row.max || 0) + 1).padStart(3, "0");
}

const toDb = (v, id) => ({
  id,
  title: v.title,
  domain: v.domain,
  mode: v.mode,
  location: v.location,
  skills: JSON.stringify(v.skills),
  openings: v.openings,
  duration_weeks: v.duration_weeks,
  applications_open: v.applications_open ? 1 : 0,
});

// ---------- routes ----------
app.get("/", (req, res) => {
  ok(res, { name: "Internship API", endpoints: "/api/internships" });
});

// LIST with pagination + optional filters: ?page=1&limit=5&domain=UI/UX&mode=Remote&q=sql
app.get("/api/internships", (req, res) => {
  const { errors, page, limit } = parsePagination(req.query);

  const where = [];
  const params = {};

  if (req.query.domain !== undefined) {
    where.push("LOWER(domain) = LOWER(@domain)");
    params.domain = String(req.query.domain);
  }
  if (req.query.mode !== undefined) {
    if (!MODES.some((m) => m.toLowerCase() === String(req.query.mode).toLowerCase()))
      errors.push({ field: "mode", message: `mode must be one of: ${MODES.join(", ")}.` });
    else {
      where.push("LOWER(mode) = LOWER(@mode)");
      params.mode = String(req.query.mode);
    }
  }
  if (req.query.q !== undefined && String(req.query.q).trim() !== "") {
    where.push("(title LIKE @q OR domain LIKE @q OR location LIKE @q OR skills LIKE @q)");
    params.q = `%${String(req.query.q).trim()}%`;
  }

  if (errors.length) return fail(res, 400, "VALIDATION_ERROR", "Invalid query parameters.", errors);

  const clause = where.length ? "WHERE " + where.join(" AND ") : "";
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM internships ${clause}`).get(params);
  const rows = db
    .prepare(`SELECT * FROM internships ${clause} ORDER BY id LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset: (page - 1) * limit });

  const totalPages = Math.max(1, Math.ceil(total / limit));
  ok(res, rows.map(toRecord), {
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  });
});

// DETAIL
app.get("/api/internships/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM internships WHERE id = ?").get(req.params.id);
  if (!row) return fail(res, 404, "NOT_FOUND", `Internship ${req.params.id} not found.`);
  ok(res, toRecord(row));
});

// CREATE
app.post("/api/internships", (req, res) => {
  const { errors, value } = validateInternship(req.body);
  if (errors.length) return fail(res, 400, "VALIDATION_ERROR", "Invalid input.", errors);

  const id = value.id || nextId();
  if (db.prepare("SELECT 1 FROM internships WHERE id = ?").get(id))
    return fail(res, 409, "CONFLICT", `Internship ${id} already exists.`);

  db.prepare(
    `INSERT INTO internships (id, title, domain, mode, location, skills, openings, duration_weeks, applications_open)
     VALUES (@id, @title, @domain, @mode, @location, @skills, @openings, @duration_weeks, @applications_open)`
  ).run(toDb(value, id));

  const row = db.prepare("SELECT * FROM internships WHERE id = ?").get(id);
  res.location(`/api/internships/${id}`);
  ok(res, toRecord(row), {}, 201);
});

// UPDATE (full replace of the editable fields)
app.put("/api/internships/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM internships WHERE id = ?").get(req.params.id);
  if (!existing) return fail(res, 404, "NOT_FOUND", `Internship ${req.params.id} not found.`);

  const { errors, value } = validateInternship(req.body);
  if (value && value.id && value.id !== req.params.id)
    errors.push({ field: "id", message: "id in the body must match the id in the URL." });
  if (errors.length) return fail(res, 400, "VALIDATION_ERROR", "Invalid input.", errors);

  db.prepare(
    `UPDATE internships SET title=@title, domain=@domain, mode=@mode, location=@location,
       skills=@skills, openings=@openings, duration_weeks=@duration_weeks,
       applications_open=@applications_open WHERE id=@id`
  ).run(toDb(value, req.params.id));

  const row = db.prepare("SELECT * FROM internships WHERE id = ?").get(req.params.id);
  ok(res, toRecord(row));
});

// DELETE
app.delete("/api/internships/:id", (req, res) => {
  try {
    const result = db.prepare("DELETE FROM internships WHERE id = ?").run(req.params.id);
    if (result.changes === 0)
      return fail(res, 404, "NOT_FOUND", `Internship ${req.params.id} not found.`);
    ok(res, { id: req.params.id, deleted: true });
  } catch (err) {
    if (String(err.code).startsWith("SQLITE_CONSTRAINT"))
      return fail(res, 409, "CONFLICT", "This internship has applications and cannot be deleted.");
    throw err;
  }
});

// ---------- error handling ----------
app.use((req, res) => fail(res, 404, "NOT_FOUND", `Route ${req.method} ${req.path} not found.`));

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed")
    return fail(res, 400, "INVALID_JSON", "Request body is not valid JSON.");
  if (err.type === "entity.too.large")
    return fail(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  console.error(err.message); // log the message only, never request bodies
  fail(res, 500, "INTERNAL_ERROR", "Something went wrong on the server.");
});

module.exports = app;
