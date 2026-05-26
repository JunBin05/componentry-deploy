# Componentry

An AI-powered quotation tool for PC hardware suppliers. Describe a customer's
requirements in plain text, and the system selects compatible parts from your
catalog, checks hardware compatibility, and produces a printable quotation
document in seconds.

Live demo: https://componentry-deploy.vercel.app/

---

## The problem

When a PC store receives a customer's build request, they relay it to their hardware supplier for a quotation. Today that process looks like this:

- Sales staff manually cross-reference component lists against an outdated spreadsheet
- Compatibility is checked from memory — wrong socket types and undersized PSUs happen
- Each quote takes **20 to 40 minutes** to produce
- By the time the quote reaches the customer, stock may already be gone

Existing CPQ software (Salesforce CPQ, Oracle CPQ, SAP CPQ) costs hundreds of dollars per user per month and requires months of IT implementation. SME hardware suppliers have no viable option.

## The solution

Componentry is an AI agent that takes a plain-English brief and a budget, then autonomously:

1. Filters the supplier's catalog to in-stock products only
2. Selects a compatible set of components within the budget, weighted by use case
3. Validates every hard compatibility constraint through a rule-based engine
4. Self-corrects and retries if any constraint fails
5. Returns a professional quote with per-part reasoning and cheaper/premium alternatives

**End-to-end in under a minute. No IT team. No configuration.**

## Why existing solutions don't work for SMEs

| Product | Cost | Deployment |
|---|---|---|
| Salesforce CPQ | ~RM 350–700 / user / month | Months of IT implementation |
| Oracle CPQ | Six-figure annual contracts | Dedicated implementation team |
| SAP CPQ | Enterprise pricing | Global IT infrastructure required |
| **Componentry** | **Fraction of the cost** | **Running in under a day** |

Beyond cost, traditional CPQ requires a human to manually configure every compatibility rule — "if CPU socket is LGA1700, motherboard must also be LGA1700" — across thousands of product combinations. That work takes months and breaks every time a new product launches.

Componentry is AI-native. Compatibility is understood from the model's training, not configured by a human. A supplier uploads their catalog and is quoting in minutes.

---

## Architecture overview

<div style="text-align: center; align-items: center">
  <img src="https://raw.githubusercontent.com/invzfnc/componentry/main/docs/componentry_agent_flow.svg" alt="Desktop view">
  <p align="center">Agentic framework architecture diagram</p>
</div>

The system has three main layers:

- **Frontend** — React SPA deployed on Vercel. Handles authentication, catalog
  management, the quote generation workflow, and the printable quotation output.
- **Backend** — FastAPI service deployed on Google Cloud Run. Runs the LLM-based
  quote agent (Gemini), the rule-based compatibility engine, and exposes REST
  and SSE endpoints.
- **Database** — Supabase (PostgreSQL). Stores the parts catalog, saved quotes,
  and per-user supplier settings. The frontend reads and writes directly to
  Supabase for catalog and quote data. The backend reads the catalog from
  Supabase (or a local JSON fallback) for quote generation.

---

## System requirements

| Requirement | Version |
|---|---|
| Node.js | 18 or later |
| npm | 9 or later |
| Python | 3.10 or later |
| pip | 23 or later |

---

## Dependencies

### Frontend

| Package | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Dev server and build tool |
| TypeScript | Type safety |
| Tailwind CSS v4 | Utility-first styling |
| Framer Motion | Animations |
| @supabase/supabase-js | Supabase client for auth and database |

### Backend

| Package | Version | Purpose |
|---|---|---|
| fastapi | 0.128.7 | API framework |
| uvicorn | 0.40.0 | ASGI server |
| google-genai | 1.62.0 | Gemini LLM client |
| python-dotenv | 1.2.1 | Environment variable loading |
| pydantic | 2.12.5 | Request/response validation |
| pytest | 9.0.3 | Test runner |
| httpx | 0.28.1 | Async HTTP client (used in tests) |

---

## Project structure

```
componentry/
├── frontend/                  # React application
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── types.ts
│   │   ├── context/
│   │   ├── services/
│   │   └── components/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
│
└── backend/                   # FastAPI application
    ├── main.py
    ├── agent.py
    ├── brief_parser.py
    ├── compat.py
    ├── catalog_store.py
    ├── data/
    │   ├── catalog.json
    │   └── inventory.json
    ├── .env.example
    └── requirements.txt
```

---

## Local setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd componentry
```

---

### 2. Configure the frontend

#### 2a. Install dependencies

```bash
cd frontend
npm install
```

#### 2b. Set up environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set the following:

```
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key_here"
```

Both values are available in your Supabase project under
**Project Settings > API**.

#### 2c. Start the development server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`.

Vite proxies all `/api/py/*` requests to the backend at
`http://localhost:8000`. The backend must be running for quote generation and
compatibility checking to work.

---

### 3. Configure the backend

#### 3a. Create a virtual environment

```bash
cd backend
python -m venv venv
```

Activate it:

```bash
# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

#### 3b. Install dependencies

```bash
pip install -r requirements.txt
```

#### 3c. Set up environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set the following:

```
GEMINI_API_KEY=your_gemini_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

`GEMINI_API_KEY` can be obtained from
[Google AI Studio](https://aistudio.google.com/app/apikey).


#### 3d. Start the backend server

```bash
python -m uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Visit
`http://localhost:8000/health` to confirm the service is running.

---

### 4. Verify the setup

With both servers running:

1. Open `http://localhost:3000` in a browser.
2. Create an account or log in.
3. Navigate to **New Quote**, enter a brief and budget, and click **Generate Quote**.
4. If the backend is reachable, the processing screen will appear and a quote
   will be generated within a few seconds.

If the backend is not reachable, the frontend will display an alert after the
generation attempt fails. Check that the backend is running on port 8000 and
that no firewall or proxy is blocking the connection.

---

## Running tests (backend)

```bash
cd backend
pytest
```

To run the built-in compatibility engine self-tests directly:

```bash
python compat.py
```

---

## Deployment

### Frontend (Vercel)

The frontend is a standard Vite project and deploys without additional
configuration on Vercel. Set the `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` environment variables in the Vercel project settings.

The Vite proxy used for local development is replaced in production by a
rewrite rule in `vercel.json` that forwards `/api/py/*` to the Cloud Run
service URL. Update that URL when redeploying the backend.

### Backend (Google Cloud Run)

The backend is deployed as a containerised FastAPI service on Cloud Run. Set
`GEMINI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` as Cloud Run
environment variables or Secret Manager references. The service does not
require a minimum instance count but benefits from one to avoid cold-start
latency on the first quote request.

---

## Environment variable reference

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous public key |

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |

---

## License

All rights reserved by the team.