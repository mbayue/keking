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

## Notes

- The bot already syncs guild records and deploys commands on startup/join.
- If you want to force a refresh, use `/sync force:true`.
- For managed Postgres providers, point `DATABASE_URL` at the external database and remove or ignore the local `db` service.
