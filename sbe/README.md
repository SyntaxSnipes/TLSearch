# TLSearch (Space Biology Engine)

This project has two deployable services:
- Next.js frontend/API proxy in [sbe](.)
- FastAPI backend in [sbe/src/server](src/server)

## Local Development

1. Install frontend deps:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Install backend deps:

```bash
cd src/server
python3 -m pip install -r requirements.txt
```

4. Start backend:

```bash
cd src/server
fastapi dev api.py
```

5. Start frontend:

```bash
npm run dev
```

## Deployment Readiness

Configured for deployment:
- Next.js `output: "standalone"` in [sbe/next.config.ts](next.config.ts)
- Backend health endpoint: `GET /healthz`
- Backend dependency lock-in: [sbe/src/server/requirements.txt](src/server/requirements.txt)
- Env template: [sbe/.env.example](.env.example)

### Required Environment Variables

For frontend service:
- `API_ORIGIN` : public/private URL of backend (example: `https://api.yourdomain.com`)
- `USE_BACKEND` : set to `1` to enable backend-powered `/api/search`

For backend service:
- `OPENAI_API_KEY` : required for OpenAI summaries/embeddings
- `BACKEND_CORS_ORIGINS` : comma-separated list of frontend origins

## Production Build Commands

Frontend:

```bash
npm run build
npm run start
```

Backend:

```bash
cd src/server
uvicorn api:app --host 0.0.0.0 --port 8000
```

## Recommended Deployment Topology

1. Deploy FastAPI (`src/server`) to a Python host (Render, Railway, Fly.io, VM, etc.).
2. Deploy Next.js (`sbe`) to Vercel or Node host.
3. Set frontend `API_ORIGIN` to deployed backend URL.
4. Set backend `BACKEND_CORS_ORIGINS` to deployed frontend URL.

## Smoke Test Checklist

1. `GET /healthz` returns `{"status":"ok"}` on backend.
2. Search page returns results from `/api/papers`.
3. AI summary button returns either OpenAI summary or fallback summary.
4. Frontend build passes: `npm run build`.
