# Deployment

## Docker

This project includes a production-ready Docker setup with:

- a multi-stage `Dockerfile`
- a `docker-compose.yml` stack for the bot and PostgreSQL
- automatic restart policies
- a Postgres healthcheck before the bot starts

## 1. Prepare env

Create a `.env` file based on `.env.example`.

Required values:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`

Optional values:

- `DISCORD_GUILD_ID`
- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

If `DATABASE_URL` is omitted in Docker Compose, it defaults to the bundled `db` service.

## 2. Start the stack

```bash
bun run docker:up
```

Or directly:

```bash
docker compose up -d --build
```

## 3. Check logs

```bash
bun run docker:logs
```

## 4. Stop the stack

```bash
bun run docker:down
```

## Health endpoints

The bot serves `GET /healthz`, `GET /readyz`, and `GET /metrics` on `HEALTH_PORT` (default `3000`).

In Docker Compose the bot binds `0.0.0.0` and publishes the port with `expose:`, so it is reachable from other containers on the compose network but not published to the host. `METRICS_TOKEN` is required in that mode and the bot refuses to start without it.

To scrape from a host-level Prometheus, add a host-loopback binding to the `bot` service:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

Scrape with the bearer token:

```yaml
authorization:
  type: Bearer
  credentials: <METRICS_TOKEN>
```

## CI and tests

GitHub Actions runs on pushes and pull requests to `master`:

- `bun install --frozen-lockfile`
- `bun run check`
- `bun run test:coverage` against a PostgreSQL 16 service
- `bun run build`

Run the same checks locally with:

```bash
bun run check
bun run test:coverage
bun run build
```

## Notes

- The bot syncs guild records and deploys commands on startup/join. `/guildinfo` shows deployment info.
- To redeploy commands manually, run `bun run deploy:commands`. Unchanged command payloads are skipped using the stored hash.
- For managed Postgres providers, point `DATABASE_URL` at the external database and remove or ignore the local `db` service.
- See [`README.md`](./README.md#project-structure) for the source layout.
