# Repository Guidelines

## Project Overview

Keking is a Discord bot built with Bun and TypeScript. It provides music playback, TTS voice, Keqing AI chat, social-link previews, NovelPia search, and server admin utilities. It uses `discord.js` with an in-memory `discord-player` queue and PostgreSQL for durable guild, AI-memory, and social-preview state.

The bot is intentionally Bun-only: it uses top-level await, `bun:test`, `Bun.sleep`, and Bun's automatic `.env` loading. Do not introduce a Node/tsx runtime path.

Current AI defaults (Vultr, OpenAI-compatible endpoint at `https://api.vultrinference.com/v1`):

- Chat primary: `minimax-m3.1-flash`
- Fallback: `mimo-v2.6-flash`
- Premium/last fallback: `deepseek-v4.1-flash-1017`
- Image input: `qwen3.8-flash-next`
- Image generation: `qwen-image-2.1`
- Reasoning effort: `minimal` (sent as `reasoning_effort`; keeps replies fast and stops reasoning from consuming the whole token budget)

PostgreSQL is effectively mandatory: `src/db/postgres.ts` creates a pool at module load and throws when `DATABASE_URL` is missing.

## Architecture & Data Flow

### Startup

`src/index.ts` performs, in order:

1. Create the Discord `Client`.
2. `initializePlayer()` from `src/music/player.ts`.
3. Load commands into `client.commands`.
4. `initializeGuildStorage()` from `src/db/postgres.ts` when configured.
5. Load events.
6. `client.login()`.

Startup aborts before login if the database cannot connect. Migrations run from `./drizzle` during storage initialization.

### Gateway flow

- `src/events/message-create.ts`: try `handleKeqingChat()` first; if it returns `false`, run `previewSocialLinks()`. `MissingBotPermissionsError` becomes a friendly reply.
- `src/events/interaction-create.ts`: dispatch slash commands by `data.name`; handle music buttons with `music_` custom IDs; central error embeds.
- `src/events/message-reaction-add.ts`: rotate social-preview cards via `handlePreviewReaction()`.
- `src/events/client-ready.ts`: deploy commands and sync cached guilds. `guild-create.ts` upserts/deploys; `guild-delete.ts` removes guild data.
- SIGINT/SIGTERM close the Discord client and database pool.

### Dynamic loading

`src/utils/load-files.ts` recursively imports every `.ts`/`.js` file under `src/commands` and `src/events` (skips `.d.ts`). Adding a command or event means adding a file there; no registry edit is required.

- Commands export `command: SlashCommand` with `data` and `execute`.
- Events export `event: BotEvent` with `name`, optional `once`, and `execute`.
- Commands with `requiresMusic` are removed when `MUSIC_ENABLED !== "true"`. `/tts` is intentionally not gated.
- Command deployment uses a per-guild hash and skips unchanged payloads.

### AI flow

`src/ai/keqing/handler.ts` is the entry point for mention/reply chat:

- Requires a guild message from a non-bot author, a bot mention or a reply to a bot message, an AI key, and the guild AI toggle.
- AI toggle read failures fail closed.
- Loads per-guild/per-user memory (last 10 turns, 12,000-character cap). Turns are trimmed on load as well as on save, so a row stored under an older window is never sent to the model in full.
- Builds prompt context from Discord author/server mentions, quoted reply text, and optional channel recap.
- Routes image requests to `AI_VISION_MODEL`; routes text through `AI_MODEL`, `AI_FALLBACK_MODEL`, then `AI_PREMIUM_MODEL`.
- Explicit image-generation requests use `AI_IMAGE_MODEL` and return a Discord attachment.
- Replies pass through reasoning stripping, emoji stripping, a 400-character sentence-aware cap, and optional TTS.

Image understanding uses attachment URLs, not base64 data URLs. Base64 images can explode past the vision model's context window.

### Social previews

`src/social/domains.ts` defines domains, URL patterns, fix methods, and rewrites. `src/social/links.ts` handles opt-outs, extraction, and rotation. `src/social/cards.ts` fetches metadata and renders Components V2. `src/social/handlers/` contains Discord message/reaction adapters. Scope is stored through `src/db/postgres.ts`.

### Music and TTS

`src/music/player.ts` wraps `discord-player`, queue state, voice joining/leaving, and TTS playback. `src/music/events.ts` wires player events; `src/music/lyrics.ts` queries Genius. `src/tts/` owns provider synthesis and the single TTS extractor. Music is disabled unless `MUSIC_ENABLED=true`; TTS remains available.

### State ownership

- PostgreSQL: guild records, command hashes, AI memory, social-preview scopes/replies.
- In-memory: player queues, voice connections, AI in-flight conversation lock.
- No general channel history or reference images are persisted.

## Key Directories

| Directory | Purpose |
|---|---|
| `src/ai/keqing/` | AI handler, routing, memory, persona, context, image input/generation, reply formatting |
| `src/social/` | Domain registry, link rewriting, cards, Discord handlers |
| `src/music/` | Player, player events, lyrics |
| `src/tts/` | Google/ElevenLabs synthesis and extractor |
| `src/commands/` | Slash commands grouped as `admin`, `integrations`, `music`, `utility` |
| `src/db/` | Drizzle schema and PostgreSQL storage |
| `src/events/` | Gateway event adapters |
| `src/loaders/` | Recursive command/event loading |
| `src/utils/` | Embeds, permissions, deployment, file loading |
| `src/observability/` | Structured logger, Prometheus metric registry, health/metrics HTTP server |
| `src/structures/` | Command/event type contracts |
| `scripts/` | Deploy, clear, smoke probes; `tmp-*` files are scratch |
| `test/` | Domain-mirrored Bun tests |
| `docs/` | Hand-authored static documentation site |

## Development Commands

```bash
bun install

bun run dev                 # bun --hot src/index.ts
bun run start               # bun src/index.ts (source, not dist)
bun run check               # tsc --noEmit
bun test
bun run test:coverage       # 100% gate
bun run build               # dist/ is not used by start or Docker

bun run smoke
bun run deploy:commands
bun run deploy:clear-commands

docker compose up -d db     # local Postgres on host port 5433
```

`bun run start` and Docker run TypeScript directly. `build` is a separate distribution artifact.

## Code Conventions & Common Patterns

- TypeScript is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax`. Use `import type` for type-only imports.
- Source imports use `.js` specifiers for `.ts` files. Tests import source with explicit `.ts` specifiers.
- `tsconfig.json` includes only `src/**/*`; `check` does not typecheck `test/`, `scripts/`, or `drizzle.config.ts`.
- No ESLint, Prettier, or lint script. Use `bun run check` plus the test suite.
- Bun loads `.env` automatically. A real process environment variable wins over `.env`; verify `AI_MODEL` before restarting if the running model looks stale.
- `src/config.ts` exports a one-shot `config` object. Add new environment variables there and in `.env.example`, tests, and README.
- Add commands/events by dropping properly exported files under the relevant directory; the loader discovers them recursively.
- Central errors use Discord embeds. Preserve the special handling for `MissingBotPermissionsError`.
- Prefer optional-last-parameter dependency injection for tests (`fetchLyrics(client)`, TTS client, memory store, prune/schedule) over mocking modules.
- Network/time tests patch `globalThis.fetch` and `Bun.sleep`, restoring them in `afterEach`/`afterAll`.
- Keep secrets, message content, and AI prompt text out of logs. `.env` is gitignored and dockerignored.
- Image prompts should strip Discord mentions and translate Indonesian terms before sending to image models; self-references map to Keqing.
- Send vision images as attachment URLs; base64 data URLs trigger context overflow.
- Strip `<think>` blocks and emoji from model output before sending, speaking, or storing it.
- Database module initialization is module-scoped: do not call `closeDb()` until no tests in the process need the pool.

## Important Files

- Runtime entry: `src/index.ts`
- Client/event contracts: `src/types/client.ts`, `src/structures/`
- Configuration: `src/config.ts`
- AI: `src/ai/keqing/handler.ts`, `completion.ts`, `memory.ts`, `persona.ts`, `image-input.ts`, `image-generation.ts`, `image-intent.ts`, `reply-format.ts`
- Persona: `src/ai/keqing/persona.ts` uses a Soul document structure (`Basic Identity`, `Core Temperament`, `Outer Style`, `Language System`, `Action Logic`, `Hidden Traits`, `Boundaries`) in compact prose. It is sent on every request, so its token count dominates per-request cost — keep it near 1,600 tokens and verify with a live quality sweep before changing rules.
- Mentions: request-driven only. `src/ai/keqing/mention-intent.ts` detects an explicit ask to address someone; `keepMentions` in `handler.ts` drops any mention the model invented, and the code guarantees the mention exists when it was requested. Never let the model decide who gets pinged.
- Database: `src/db/postgres.ts`, `src/db/schema.ts`, `drizzle/`
- Command deployment: `src/utils/deploy-commands.ts`
- Loader: `src/utils/load-files.ts`, `src/loaders/commands.ts`
- Observability: `src/observability/logger.ts`, `src/observability/metrics.ts`, `src/observability/health.ts`
- Coverage/config: `bunfig.toml`, `tsconfig.json`, `package.json`
- CI: `.github/workflows/ci.yml`
- Container: `Dockerfile`, `docker-compose.yml`
- Scripts: `scripts/deploy-commands.ts`, `scripts/clear-commands.ts`, `scripts/smoke.ts`
- Docs: `README.md`, `DEPLOYMENT.md`, `docs/`
- Brand: `logo/guidelines.md`

## Runtime/Tooling Preferences

- Runtime: Bun 1.4.4 in CI; README requires Bun 1.4+.
- Package manager: Bun only, with `bun.lock`; use `bun install --frozen-lockfile` in CI.
- Database: PostgreSQL. Compose exposes **5433**; CI uses **5432**.
- Docker image: `oven/bun:1-slim`, multi-stage, installs `ffmpeg`, `yt-dlp`, and `libopus0`.
- Discord: `discord.js` with Guilds, GuildVoiceStates, GuildMessages, GuildMessageReactions, and MessageContent intents.
- AI provider: OpenAI-compatible endpoint; AI chat is disabled when the key is empty, but the bot can start.
- CI does not run smoke, does not deploy, and does not need an AI key.
- `scripts/` and `bunfig.toml` are not copied into the Docker image, so operational scripts and the smoke check cannot run inside the container.
- Docker Compose overrides `DATABASE_URL` with the `db` service URL; changing `.env` alone does not repoint a containerized bot.
- Health server: binds `HEALTH_HOST` (default `127.0.0.1`) on `HEALTH_PORT`. `/metrics` requires a bearer token whenever one is configured and rejects all requests on a non-loopback bind without one; the bot refuses to start in that configuration.
- Docker Compose sets `HEALTH_HOST=0.0.0.0` and publishes the port with `expose:` on the private compose network, so `METRICS_TOKEN` is required in containers.
- A real process environment variable beats `.env`. When a launched process still shows stale model values, check the inherited environment before `.env`.

## Testing & QA

- Framework: Bun's built-in `bun:test`. No Jest/Vitest.
- Tests mirror source domains under `test/<domain>/<module>.test.ts`.
- Coverage gate: `bunfig.toml` requires **100% lines and functions**. There is no branch threshold.
- Coverage exclusions are deliberate adapter/bootstrap files: commands, events, loaders, player/events, social cards/handlers, TTS extractor, AI handler/index, Discord permissions/deploy utilities, and type-only structures. The observability modules are covered and must stay at 100%.
- Bun reports only modules loaded by tests. A new unimported module is absent from the report; once imported, it must reach 100%.
- Coverage fixtures must be committed, not just present locally. `test/fixtures/load-files/ignored.d.ts` is gitignored by the `*.d.ts` rule and needs the explicit negation in `.gitignore`; without it the `.d.ts` skip branch in `src/utils/load-files.ts` is never executed and the 100% gate fails in CI while passing locally.
- The PostgreSQL integration test is mandatory for the gate. It requires `DATABASE_URL`, runs migrations, uses a unique guild/message ID, creates a raw `pg` pool for timestamp manipulation, and closes both pools in `afterAll`.
- Start the compose database before local coverage:
  ```bash
  docker compose up -d db
  bun run test:coverage
  ```
- Tests patch global `fetch` and `Bun.sleep`; restore them in cleanup. Expected error logs from negative tests are noisy but not failures.
- `bun run smoke` needs a live DB, valid Discord token, deployed commands, and a non-empty AI key. It is not run in CI.
- When changing commands, update `scripts/smoke.ts` expected names, `help.ts`, README command lists, and static docs.
- When changing AI models or image routing, update `src/config.ts`, tests, `.env.example`, README (three model/env locations), and docs.
- `bun run check` is not a lint/test substitute; run the full coverage gate before declaring completion.
