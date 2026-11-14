# Internship REST API

A Node.js + Express API for internship records with validation, pagination and SQLite persistence.
All data is fictional (EdVyro training material).

## Tech
- Node.js 22 or newer, and Express
- SQLite via `better-sqlite3` (file database, no separate server needed)

## Setup
```bash
npm install
npm run seed      # creates the database and loads sample records (safe to run again)
npm start         # http://localhost:3000
```
Optional environment variables (see `.env.example`): `PORT` (default 3000), `DB_FILE` (default `data/internships.db`).
They are read from the environment, for example `PORT=4000 npm start`. No secrets are needed.

## Data model
Defined in [`schema.sql`](schema.sql). It extends the supplied starter database with `location`, `skills` and `openings` so the supplied JSON seed fits.

| Field | Type | Rules |
|---|---|---|
| `id` | text | Optional on create (format `INT-123`, auto-generated if omitted). Never changes. |
| `title` | text | Required, 3 to 100 characters |
| `domain` | text | Required, 2 to 60 characters |
| `mode` | text | Required: `Remote`, `Hybrid` or `On-site` |
| `location` | text | Optional, up to 60 characters |
| `skills` | array of text | Optional, up to 10 items, each up to 30 characters |
| `openings` | integer | Optional, 0 to 1000 (default 1) |
| `duration_weeks` | integer | Optional, 1 to 52 (default 4) |
| `applications_open` | boolean | Optional (default true) |

The `applications` table from the starter database is kept in the schema for later tasks.

## Seed data
`npm run seed` loads:
- `seed/seed.sql`: the 4 records from the supplied SQL sample (INT-001 to INT-004)
- `seed/internships.json`: the 5 records from the supplied JSON seed (INT-101 to INT-105)

Original IDs are preserved. Total: 9 records.

## Response format
Success:
```json
{ "status": "success", "data": { }, "pagination": { } }
```
`pagination` appears only on the list endpoint.

Error:
```json
{ "status": "error", "error": { "code": "VALIDATION_ERROR", "message": "Invalid input.", "details": [ { "field": "title", "message": "title is required." } ] } }
```

## Endpoints
| Method | Path | Description | Success |
|---|---|---|---|
| GET | `/api/internships` | List with pagination and filters | 200 |
| GET | `/api/internships/:id` | One record | 200 |
| POST | `/api/internships` | Create | 201 |
| PUT | `/api/internships/:id` | Update (send all required fields) | 200 |
| DELETE | `/api/internships/:id` | Delete | 200 |

List query parameters: `page` (default 1), `limit` (default 10, max 50), `domain`, `mode`, `q` (search in title, domain, location, skills).

Pagination metadata: `page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`.

### Status codes
| Code | When |
|---|---|
| 200 | OK |
| 201 | Created (also sets a `Location` header) |
| 400 | Validation error, invalid query parameters or invalid JSON |
| 404 | Record or route not found |
| 409 | Duplicate id on create, or deleting a record that has applications |
| 413 | Request body too large |
| 500 | Unexpected server error (message only, no internal details) |

## API examples (curl)
```bash
# List, page 1, 3 per page
curl "http://localhost:3000/api/internships?page=1&limit=3"

# Filter and search
curl "http://localhost:3000/api/internships?domain=Full%20Stack%20Development&mode=Remote"
curl "http://localhost:3000/api/internships?q=sql"

# One record
curl http://localhost:3000/api/internships/INT-102

# Create
curl -X POST http://localhost:3000/api/internships \
  -H "Content-Type: application/json" \
  -d '{"title":"QA Intern","domain":"Quality Assurance","mode":"Remote","skills":["Testing"],"openings":2}'

# Update
curl -X PUT http://localhost:3000/api/internships/INT-106 \
  -H "Content-Type: application/json" \
  -d '{"title":"QA Intern","domain":"Quality Assurance","mode":"Hybrid","openings":4}'

# Delete
curl -X DELETE http://localhost:3000/api/internships/INT-106
```
On Windows, `requests.http` has the same requests for the VS Code "REST Client" extension (click "Send Request" above each one).

## Test results
Checked against a freshly seeded database:

| Request | Result |
|---|---|
| `GET /api/internships?page=1&limit=3` | 200, 3 records, total 9, totalPages 3 |
| `GET /api/internships?page=3&limit=4` | 200, 1 record, `hasNext: false` |
| `GET ...?domain=Full Stack Development&mode=remote` | 200, INT-101 only |
| `GET ...?q=sql` | 200, INT-102 and INT-104 |
| `GET ...?limit=999&page=0` | 400 with details for both fields |
| `GET /api/internships/INT-102` | 200 |
| `GET /api/internships/INT-999` | 404 |
| `POST` valid body | 201, id `INT-106` generated |
| `POST` invalid body (short title, bad mode, negative openings, unknown field) | 400 with one detail per problem |
| `POST` existing id | 409 |
| `POST` broken JSON | 400 `INVALID_JSON` |
| `PUT` valid / missing id / id mismatch | 200 / 404 / 400 |
| `DELETE` existing / already deleted | 200 / 404 |
| Unknown route | 404 JSON error |

## Project structure
```
server.js            starts the server
src/app.js           routes and response helpers
src/validate.js      input and pagination validation
src/db.js            opens the database and applies schema.sql
schema.sql           tables
seed/                seed script, SQL records and JSON records
requests.http        ready-made requests for VS Code REST Client
```

## Notes
- All database queries use parameters, so user input is never joined into SQL.
- Errors log only the message, never request bodies.
