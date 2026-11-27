# TrailNav Nepal API

Backend REST API for **TrailNav Nepal**, an offline-first Himalayan trekking and navigation platform.

Built with **Bun**, **Hono**, **PostgreSQL + PostGIS**, **Drizzle ORM**, **Better Auth**, **Arcjet**, and **Scalar OpenAPI**.

## Local Setup

```bash
bun install
cp .env.example .env.local
docker compose up -d
bun run db:migrate
bun run dev
```

API documentation is served at `http://localhost:3000/docs` (`/openapi.json`).

## Scripts

- `bun run dev` — start development server with hot reload
- `bun run typecheck` — run TypeScript compiler checks
- `bun test` — execute test suite
- `bun run build` — build production bundle into `dist/`
- `bun run db:migrate` — apply Drizzle SQL migrations
