# Migrations

Empty on purpose. The schema now targets Postgres (see `schema.prisma`), but the
migrations that used to live here were generated against SQLite and are not valid
Postgres SQL, so they were removed rather than carried forward.

The **first** person to run `npm run db:migrate` (= `prisma migrate dev --name init`)
against a real Postgres `DATABASE_URL`/`DIRECT_URL` (local Docker Postgres or a Supabase
project - see [`docs/DEPLOYMENT.md`](../../../../docs/DEPLOYMENT.md)) regenerates a fresh
baseline migration here from the current schema. Commit whatever folder that command
creates. Everyone else, and every deploy, uses `npm run db:migrate:deploy`
(`prisma migrate deploy`) to apply it - never `db:migrate` again after that first time.
