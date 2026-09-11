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

> `npm run migrate` drops and recreates all tables.

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
