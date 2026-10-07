# EIA AI Platform

AI-Assisted Environmental Impact Assessment (EIA) platform for industrial projects.

> Decision-support only. Regulatory thresholds, emission factors and compliance
> decisions must come from current authoritative sources and validated methodologies.

## Architecture

```text
React frontend  ──►  Node/Express backend  ──►  PostgreSQL/PostGIS
                              │
                              ▼
                     FastAPI analytics service ──► external providers
                     (fetch · normalise · GIS ·     (Open-Meteo, OpenAQ, OSM,
                      calculations · ML)             Protected Planet, CPCB/CWC,
                                                     CGWB, Bhuvan)
```

| Layer | Owns |
|---|---|
| `frontend/` | UI: forms, GIS map, dashboards, AI assistant, reports |
| `backend/` | Auth, users, projects, assessments, documents, workflow orchestration, **all database persistence** |
| `analytics-service/` | Environmental API clients, normalisation, GIS, engineering calculations, ML. Returns structured JSON to the backend |
| LLM | Explains structured results only; never makes environmental decisions |

## Repository layout

```text
eia-ai-platform/
├── compose.yaml                  development stack (see "Running in Docker")
├── .env.example                  configuration for that stack; copy to .env
│
├── frontend/                     React (Vite)
│   └── src/
│       ├── app/                  app shell
│       │   ├── providers/        global context providers
│       │   └── router/           route definitions
│       ├── assets/               images, icons
│       ├── components/           shared UI
│       │   ├── ui/               buttons, inputs, cards, modals
│       │   ├── layout/           navbar, sidebar, page shells
│       │   ├── charts/           Recharts wrappers
│       │   └── maps/             Leaflet wrappers
│       ├── features/             one folder per domain (components/ hooks/ api/)
│       │   ├── auth/
│       │   ├── projects/
│       │   ├── assessments/
│       │   ├── environmental-data/
│       │   ├── gis/
│       │   ├── impact-results/
│       │   ├── recommendations/
│       │   ├── reports/
│       │   └── ai-assistant/
│       ├── pages/                route-level screens composed from features
│       ├── services/api/         HTTP client for the Node backend
│       ├── hooks/                shared hooks
│       ├── context/              shared React context
│       ├── utils/
│       ├── constants/
│       └── styles/
│
├── backend/                      Node.js / Express
│   ├── src/
│   │   ├── config/               database connection
│   │   ├── routes/               URL → controller mapping
│   │   ├── controllers/          request/response handling
│   │   ├── validators/           request validation chains
│   │   ├── services/             business workflow / orchestration
│   │   ├── clients/              HTTP clients (FastAPI analytics service)
│   │   ├── models/               SQL queries
│   │   ├── middleware/           auth, error handling
│   │   ├── utils/
│   │   └── db/
│   │       ├── migrations/       schema (001_init.sql)
│   │       └── seeds/
│   ├── uploads/                  uploaded project documents (git-ignored)
│   └── tests/
│
├── analytics-service/            Python / FastAPI
│   ├── app/
│   │   ├── routers/              HTTP endpoints
│   │   ├── services/
│   │   │   ├── clients/          one retrieval client per external provider
│   │   │   ├── mappers/          raw provider response → platform rows (pure)
│   │   │   └── environmental_data_service.py
│   │   ├── calculations/         engineering calculation engine
│   │   ├── ml/                   feature engineering, risk models
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── schemas.py
│   │   └── main.py
│   └── tests/
│
└── docs/                         project specification and design notes
```

## Running locally

```bash
# Backend (http://localhost:5000)
cd backend && npm install && cp .env.example .env && npm run migrate && npm run dev

# Analytics service (http://localhost:8000)
cd analytics-service && python -m venv venv && venv/Scripts/pip install -r requirements.txt
cp .env.example .env && venv/Scripts/uvicorn app.main:app --reload

# Frontend (http://localhost:5173)
cd frontend && npm install && npm run dev
```

The frontend calls the backend at the relative path `/api`, which the Vite dev
server proxies to `http://localhost:5000` (see `frontend/vite.config.ts`). That
keeps the browser on one origin, so CORS is not involved in development and no
frontend `.env` is needed. Point the proxy elsewhere with `VITE_PROXY_TARGET`,
or bypass it entirely with `VITE_API_BASE_URL`.

Every API route except `/health`, `/api/auth/register` and `/api/auth/login`
requires a bearer token, so the app sends you to `/signin` until you have one.
Create an account there on first run.

### Migrations

`npm run migrate` applies each file in `backend/src/db/migrations/` once, in
filename order, each in its own transaction, and records it in the
`schema_migrations` table. Running it again does nothing. It never deletes
data: every migration only creates and alters, and `npm test` fails if one
contains `DROP TABLE`, `TRUNCATE`, `DELETE FROM` or `DROP COLUMN`.

```bash
npm run migrate          # apply whatever is pending
npm run migrate:status   # list what is pending, change nothing
```

Seeded reference data (regulatory standards, engineering coefficients,
calculation rules, the Solapur baseline) is loaded separately and is also
safe to re-run:

```bash
npm run seed:reference              # upsert, in one transaction
npm run seed:reference -- --dry-run # roll back instead of committing
```

> **`npm run migrate:reset -- --yes` drops every table and every row**,
> including all seeded reference data and every project and assessment. It is
> the only command that destroys anything, it refuses to run without `--yes`,
> and `npm run seed:reference` has to be re-run afterwards.

## Running in Docker

An alternative to the native setup above. Same three services plus a
PostGIS database, each with hot reload, so this is for working on the code
rather than for deployment.

```bash
cp .env.example .env         # then put a JWT_SECRET in it
docker compose up --build    # frontend :5173, backend :5000, analytics :8000
docker compose run --rm init # apply migrations and seed reference data
```

`init` is a one-shot container, and it is the only thing that touches the
schema. Nothing migrates on `up`, so **on a fresh volume the database is empty
until you run it** and any request that reads a table answers 500 until then.
It is safe to run again whenever a migration is added: the ledger skips what
is already applied and the seeders upsert.

```bash
docker compose logs -f backend          # follow one service
docker compose exec backend npm test    # the backend suite, in the container
docker compose run --rm analytics pytest
docker compose down                     # stop; the database volume survives
docker compose down -v                  # stop and delete the database
```

**The containerised database is not your local one.** It lives in a Docker
volume, listens on **5433** on the host specifically so it cannot collide with
the PostgreSQL install that holds 5432, and nothing in `compose.yaml` can
reach that instance. Your local `eia_platform` and everything in it is
untouched by any command here, including `down -v`.

### Configuration

`.env` at the repository root configures the stack, and is gitignored.
`JWT_SECRET` has no default: compose stops with a message rather than start
with the public placeholder from `backend/.env.example`, since a token signed
with that is forgeable by anyone who has read this repository.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The two provider API keys stay where they already are, in
`analytics-service/.env`, which the analytics container reads through its bind
mount. They are deliberately absent from the root `.env` and from
`compose.yaml`: an environment variable outranks a `.env` file, every provider
client treats an empty key as no key, and so a blank `OGD_API_KEY` in compose
would silently shadow the real one and report CPCB as "skipped".

`backend/.env` and `analytics-service/.env` are both visible inside the
containers via the bind mounts, and both are still what the native setup uses.
Where they disagree with `compose.yaml` — `DATABASE_URL` pointing at
`localhost`, for instance — compose wins: `dotenv` does not overwrite a
variable that is already set, and pydantic-settings ranks the environment
above the file.

### Notes on the containers

- **Ports.** Override any of `FRONTEND_PORT`, `BACKEND_PORT`,
  `ANALYTICS_PORT`, `DB_PORT` in `.env` if something on the host holds one.
- **Hot reload uses polling**, not filesystem events. A bind mount from a
  Windows host does not deliver inotify events into a Linux container, so the
  watchers would never fire. Hence `--legacy-watch` for the backend,
  `VITE_USE_POLLING` for the frontend and `WATCHFILES_FORCE_POLLING` for
  analytics. It costs some idle CPU and is off outside Docker.
- **`node_modules` is a named volume** for the two Node services, so the
  container keeps its own Linux build. Without that, the bind mount would
  expose the host's Windows binaries and `bcrypt` would fail to load. After
  changing a dependency, rebuild: `docker compose up --build`.
- **Python is 3.12** in the image while the host venv is 3.10.9. Every pin in
  `requirements.txt` supports both. To match the host exactly:
  `docker compose build --build-arg PYTHON_VERSION=3.10 analytics`.

## Environmental data

The backend collects the environmental baseline for an assessment's site:

```text
POST /api/assessments/:id/environmental-data   (auth; optional body { "radiusKm": 25 })
  └─► FastAPI  POST /api/environmental/fetch
        request:  site location, project context, assessment inputs entered so far
        response: observations, gis_features, providers, sections, required_inputs
  └─► stored in one transaction:
        observations   → environmental_data      (replaces the previous rows of the same providers)
        gis_features   → gis_analysis_results    (replaces the previous rows of the same providers)
        providers      → data_sources (upsert by source_key) + data_fetch_logs (appended)

GET  /api/assessments/:id/environmental-data    stored rows + the latest provider outcomes
```

The analytics service is stateless and never writes to the database. Every
provider reports `available` / `unavailable` / `error` / `skipped`, and
`sections` accounts for all 163 items of the data specification, so a value is
never invented. Items that cannot come from a coordinate are reported as
`project_input` until the matching assessment input is entered.

A fetch takes 1-4 minutes because the external providers are slow; the request
is synchronous, so keep `ANALYTICS_TIMEOUT_MS` below 300000.

## Reference data

```text
GET /api/reference/coefficients?industry=&factor=     engineering_coefficients (values used to calculate)
GET /api/reference/rules?factor=                      calculation_rules (formula + score bands)
GET /api/reference/standards?category=&parameter=&zone=&standard=&verified=
                                                      regulatory_standards (limits a value is compared against)
```

`regulatory_standards.parameter_name` matches `environmental_data.parameter_name`, so a
stored value can be joined to its limit. Compare only when the units match: CPCB
real-time values are AQI sub-indices, not concentrations.

> Seeded standards (NAAQS 2009, ambient noise 2000) and the demo coefficients are
> `verified = FALSE` / `PLACEHOLDER`. Check each against the notification named in
> `reference` before using the platform for a real assessment.

The ambient noise limit depends on `project_locations.area_classification`
(Industrial / Commercial / Residential / Silence Zone / Rural/Other) and the stricter
NAAQS SO2/NO2 limits on `ecologically_sensitive`. Neither can be derived from a
coordinate, so both are declared with the project location.
