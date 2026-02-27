# MKEHD Event Operations Suite (Starter)

Monorepo starter for an event and marketing operations platform.

## Apps

- `apps/api`: Node.js + Express + Prisma API
- `apps/web`: React + Vite frontend

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Start local Postgres (example):

```bash
docker run --name mkehd-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=mkehd -p 5432:5432 -d postgres:16
```

3. Configure API env:

```bash
cp apps/api/.env.example apps/api/.env
```

4. Run Prisma migration and seed:

```bash
npm run prisma:migrate --workspace @mkehd/api
npm run prisma:seed --workspace @mkehd/api
```

5. Start development servers:

```bash
npm run dev
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

## Default seed users

- `joe@dealership.local` (ADMIN)
- `rachel@dealership.local` (APPROVER + ADMIN)

Use the `x-user-email` header to simulate auth in API requests.

## OAuth setup

Update `apps/api/.env` with OAuth credentials:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (default: `http://localhost:4000/integrations/oauth/callback/google`)
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID` (use `common` for multi-tenant)
- `MICROSOFT_REDIRECT_URI` (default: `http://localhost:4000/integrations/oauth/callback/microsoft`)
- `OAUTH_STATE_SECRET`
- `TOKEN_ENCRYPTION_KEY` (64 hex chars recommended)

Register callback URLs in Google Cloud and Microsoft Entra before testing.

## Implemented integration endpoints

- `GET /integrations/calendars/google/auth-url`
- `GET /integrations/calendars/microsoft/auth-url`
- `GET /integrations/oauth/callback/google`
- `GET /integrations/oauth/callback/microsoft`
- `POST /integrations/calendars/sync`
- `GET /integrations/jobs`
- `GET /integrations/drives/google/files`
- `GET /integrations/drives/onedrive/files`
- `POST /integrations/drives/google/import`
- `POST /integrations/drives/onedrive/import`

## Notes

- Calendar sync is now processed through persisted sync jobs in `SyncJob`.
- Google and Microsoft tokens are encrypted before DB storage.
- iPhone calendar is represented as `ICLOUD_ICS` queue note for feed/export mode (write sync is not implemented yet).

## Deploy From Anywhere (Free-Tier Path)

This repo is set up for:

- Frontend on Vercel (free Hobby)
- API on Render Web Service (free instance)
- Database on Neon Postgres (free plan)

### 1) Create a Neon Postgres database

1. Sign in at [neon.tech](https://neon.tech/).
2. Create a project/database.
3. Copy the pooled `postgresql://...` connection string.
4. Add `?sslmode=require` if your copied URL does not already include SSL options.

### 2) Deploy API to Render

1. Sign in at [render.com](https://render.com/).
2. New + `Blueprint` (uses [`render.yaml`](/Users/josephtabora/git/mkehd/render.yaml)).
3. Select this GitHub repo and create service.
4. In the Render service environment variables, set:
   - `DATABASE_URL` = Neon connection string
   - `CORS_ORIGIN` = your Vercel frontend URL (for example `https://mkehd.vercel.app`)
   - `FRONTEND_URL` = same Vercel URL
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `https://<your-render-api>/integrations/oauth/callback/google`
   - `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
   - `MICROSOFT_REDIRECT_URI` = `https://<your-render-api>/integrations/oauth/callback/microsoft`
5. Open Render Shell and run:

```bash
npm run prisma:migrate:deploy --workspace @mkehd/api
npm run prisma:seed --workspace @mkehd/api
```

6. Verify health endpoint:
   - `https://<your-render-api>/health` should return `{ "status": "ok" }`.

### 3) Deploy frontend to Vercel

1. Sign in at [vercel.com](https://vercel.com/).
2. Import this GitHub repo.
3. Set Root Directory to `apps/web`.
4. Add env var:
   - `VITE_API_BASE_URL` = your Render API URL (for example `https://mkehd-api.onrender.com`)
5. Deploy.

### 4) Configure OAuth apps

Set redirect URIs in provider consoles:

- Google OAuth redirect: `https://<your-render-api>/integrations/oauth/callback/google`
- Microsoft OAuth redirect: `https://<your-render-api>/integrations/oauth/callback/microsoft`

Also set allowed JavaScript/web origins to your Vercel frontend domain where required.

### 5) Test end-to-end

1. Open frontend on Vercel.
2. Create an event.
3. Connect Google and Microsoft in Integrations panel.
4. Queue calendar sync.
5. Load/import files from Google Drive and OneDrive.

### Free-tier caveats

- Render free web services can spin down when idle, causing cold starts.
- Current file uploads are stored on local service disk, so they are not durable across redeploy/restarts.
  - Next recommended step: move document storage to S3/R2/Blob storage.

## Deployment files

- Render blueprint: [render.yaml](/Users/josephtabora/git/mkehd/render.yaml)
- Frontend API base env example: [apps/web/.env.example](/Users/josephtabora/git/mkehd/apps/web/.env.example)
