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
