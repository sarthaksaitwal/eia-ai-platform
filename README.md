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
