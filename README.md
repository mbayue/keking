# Keking

[![CI](https://github.com/mbayue/keking/actions/workflows/ci.yml/badge.svg)](https://github.com/mbayue/keking/actions/workflows/ci.yml)

Keking is a Discord bot built with `discord.js` and TypeScript. It focuses on music playback, text-to-speech, social-link preview helpers, and a small set of utility and admin commands.

> **Current mode:** music playback is temporarily disabled. `/join`, `/leave`, and `/tts` remain available; set `MUSIC_ENABLED=true` to re-enable the music commands.

## Features

- Music playback from YouTube links, Spotify links, and search queries (disabled by default; `/tts` stays active)
- Queue controls: play, skip, pause, resume, stop, shuffle, remove, clear, loop (disabled by default)
- Lyrics lookup through Genius (disabled by default)
- Text-to-speech playback in voice channels
- Explicit `/join` and `/leave` voice controls
- Keqing-persona AI chat on mention or reply (OpenAI-compatible API; spoken with TTS when in voice)
- Social-link preview helpers for X/Twitter, Instagram, Facebook, Reddit, Threads, TikTok, Pixiv, Bluesky, Bilibili, Pinterest, Tumblr, Twitch, and DeviantArt
- Social-preview scope controls via `/social-preview`
- NovelPia search via `/pia`
- Utility commands such as `/help`, `/ping`, `/server`, and `/forget`
- Admin health commands such as `/botstats` and `/guildinfo`
- Optional PostgreSQL storage for guild-level operational data
- Docker-based local or production deployment

## Tech Stack

- Bun 1.4+
- TypeScript
- `discord.js`
- `discord-player`
- `@discordjs/voice`
- PostgreSQL (`pg`)
- Docker / Docker Compose

## Project Structure

```text
src/
  ai/keqing/          AI chat, completion, memory, persona, Discord handler
  social/             Link-domain registry, rewriting, cards, message/reaction handlers
  music/              Player lifecycle, player events, lyrics
  tts/                ElevenLabs/Google synthesis + the TTS extractor
  commands/           admin, integrations, music, utility slash commands
  db/                 Drizzle schema + PostgreSQL storage
  events/             Discord gateway event wiring
  loaders/            Command and event discovery
  structures/         Command/event interfaces
  utils/              Embeds, permissions, deployment, file loading
  config.ts           Environment-backed configuration
  index.ts            Bot bootstrap
scripts/              deploy-commands, clear-commands, smoke
test/                 Domain-mirrored tests (ai, api, db, music, social, tts, utils)
bunfig.toml           Coverage threshold and exclusion rules
```

The shared deployment logic stays in `src/utils/deploy-commands.ts` because startup and guild events call it; the standalone entry points live in `scripts/`.

## Testing and Coverage

```bash
bun test
bun run test:coverage
```

`bunfig.toml` enforces 100% line and function coverage for the unit-testable core: configuration, database storage, AI completion/memory/persona, NovelPia, lyrics, social link logic, TTS providers, embeds, and the module loader. Discord/player/social-rendering adapters, bootstrap, and external clients are explicitly excluded in `bunfig.toml`.

CI (`.github/workflows/ci.yml`) runs `bun run check`, `bun run test:coverage` against a PostgreSQL service, and `bun run build` on pushes and pull requests to `master`.

## Observability

```text
GET /healthz   process liveness
GET /readyz    Discord and database readiness
GET /metrics   Prometheus text metrics
```

Metrics currently cover command latency, AI requests, image generation, TTS requests, database pool errors, and music queues. Durations are exposed as Prometheus histograms with buckets, so `histogram_quantile` works for percentile queries.

Access rules:

- The health server binds `127.0.0.1` by default, so the endpoints are reachable only from the host.
- `/metrics` requires `Authorization: Bearer $METRICS_TOKEN` whenever a token is configured, and rejects all requests when no token is set on a non-loopback bind.
- `/healthz` and `/readyz` are unauthenticated liveness/readiness probes.
- Setting `HEALTH_HOST` to anything other than a loopback address requires `METRICS_TOKEN`; the bot refuses to start otherwise.
- In Docker, `docker-compose.yml` sets `HEALTH_HOST=0.0.0.0` and publishes the port on the private compose network with `expose:`. A Prometheus on the host needs `ports: ["127.0.0.1:3000:3000"]` instead.

Environment settings:

- `HEALTH_ENABLED` - default `true`
- `HEALTH_HOST` - default `127.0.0.1`
- `HEALTH_PORT` - default `3000`
- `METRICS_TOKEN` - bearer token for `/metrics`; required for non-loopback binds


## Commands

### Utility

- `/forget` - delete your stored AI memory for this server (admins can target another user or use `all`)
- `/help` - list available commands
- `/ping` - show gateway latency
- `/server` - show basic server info

### Music

- `/join` - join your current voice channel and stay connected
- `/leave` - disconnect from voice
- `/tts` - play text-to-speech in voice

Music playback commands (`/play`, `/search`, `/queue`, `/now`, `/pause`, `/resume`, `/skip`, `/stop`, `/shuffle`, `/remove`, `/clear`, `/loop`, `/lyrics`) are implemented but disabled by default. Set `MUSIC_ENABLED=true` to load them. `/join`, `/leave`, and `/tts` remain available.

### AI

- Mention the bot or reply to one of its messages to chat with Keqing.
- There is no `/chat` command.

### Integrations

- `/pia` - search NovelPia titles

### Admin

- `/ai` - enable or disable AI chat for this server (Manage Server or bot owner)
- `/bottalk` - configure bot-to-bot conversation for this server: enable it, set the reply limit, and set the cooldown (Manage Server or bot owner)
- `/botstats` - show uptime, memory, ping, and voice dependency health
- `/guildinfo` - show guild and deployment info
- `/social-preview` - toggle link previews for the server, one domain, or one channel (Manage Server)

## Bot-to-Bot Conversation

Keking can hold a short exchange with another bot in the same channel. It is **off by default** and configured per server with `/bottalk`.

```text
/bottalk enabled:true|false
/bottalk limit:<1-100>        replies allowed per exchange (default 20)
/bottalk cooldown:<10-3600>   seconds to pause after the limit (default 300)
```

Guards, all enforced in `src/ai/keqing/bot-talk.ts`:

- A chain is capped at the configured number of Keqing replies (default **20**). Reaching the cap starts the cooldown (default **5 minutes**) during which peer bots are ignored in that channel.
- Once the cooldown passes the chain resets, so the bots can resume rather than staying blocked.
- A **human speaking breaks the chain**. Keqing replies to a bot again only after a person has spoken.
- Saying "stop", "berhenti", or "cukup" while the bots are talking makes Keqing acknowledge and stop, and starts the cooldown.
- Peer exchanges are channel-scoped and never written to a user's AI memory. They also never trigger image generation or TTS.

Keqing is told to add something new rather than restate the other bot, and to let the exchange end after one or two sentences. It replies with a real mention of the peer bot so the peer knows it was addressed.

Keking only answers a peer bot that addressed it — by mention, or by replying to one of Keking's messages. It ignores unrelated bots in the channel.

Replies may mention individual users so the person being addressed actually gets pinged, but only when the human asked for it — "@keking sapa @iris" gets a mention, a plain question does not. Roles are never pinged, and `@everyone` / `@here` are never used. When a reply only answers someone, it carries no mention: the reply itself already points at them.

## Social Preview Behavior

When users post supported links in a guild text channel, Keking can reply with alternative preview-friendly versions.

Supported rewrites in the current codebase (each with fallback services):

- `x.com` / `twitter.com` -> `fixupx.com` (fallbacks: `vxtwitter.com`, `fixvx.com`)
- `instagram.com` -> `kkinstagram.com` (fallback: `gginsta.com`)
- `facebook.com` / `fb.watch` -> `facebed.com`
- `reddit.com` / `redd.it` -> `rxddit.com` (fallbacks: `vxreddit.com`, `fxreddit.com`)
- `threads.com` / `threads.net` -> `fixthreads.seria.moe` (fallback: `fixembed.app`)
- `tiktok.com` (+ `vm`/`vt` shares) -> `fxtiktok.com`
- `pixiv.net` artworks -> `phixiv.net`
- `bsky.app` posts -> `bskyx.app`
- `bilibili.com` videos / `b23.tv` shares -> `vxbilibili.com` (fallback: `fxbilibili.seria.moe`)
- `pinterest.com` pins / `pin.it` shares -> `pinterestez.com`
- `*.tumblr.com` posts, `twitch.tv` clips, `deviantart.com` art — rich API cards, original link as fallback

React with 🔄 on the bot's preview reply to cycle a link through its fallback services.
Prefix a link with `$` or wrap it in `<...>` to skip previewing it.
Scope control via `/social-preview`: whole server, one link source (`domain`), or one channel (`channel`).
Replies render as rich cards (author, media, stats — FixEmbed-style) via the fixembed.app metadata API, falling back to plain mirror links when metadata is unavailable.

This behavior depends on the bot being able to read guild message content.

## AI Chat (Keqing)

Keking can roleplay Keqing, the Yuheng of the Liyue Qixing. It answers only when:

- the message mentions the bot; or
- the message replies to a message authored by the bot.

There is no `/chat` command.

The persona lives in `src/ai/keqing/persona.ts` and follows a Soul document structure: `Basic Identity`, `Core Temperament`, `Outer Style`, `Language System`, `Action Logic`, `Hidden Traits`, and `Boundaries`. `Hidden Traits` describes what sits beneath the surface rather than adding more surface rules. It is kept in compact prose so the whole prompt stays near 1,600 tokens, because the prompt is sent on every request and its size dominates the per-request cost.

When you reply to one of Keking's messages, the referenced message is included as quoted context for that request. It is capped, treated as untrusted data rather than instructions, and is not added to stored AI memory.

You can also ask for a casual channel recap by mentioning Keking or replying to it, for example: “summarize this conversation”, “what happened in this channel?”, “ringkas percakapan ini”, or “catch me up”. Keking reads up to 50 recent messages for that request only; the history is sent to the AI provider and is not stored as memory. There is no `/summarize` command.

Admins with Manage Server, or the bot owner (`330320305606230016`), can use `/ai` to enable or disable AI chat for the server. Disabling it stops AI mention/reply responses and spoken AI replies; `/tts` still works.

Discord mentions are resolved into the mentioned user’s display name, username, and ID for the model. Plain-text names that are not Discord mentions are not guessed; ask the user to mention the person or provide an ID.

If Keking is already connected to a voice channel in the same server, the reply is also spoken there through the configured TTS provider: ElevenLabs when `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set, otherwise Google Translate’s Indonesian TTS. Spoken replies are capped at 1,200 characters. Use `/join` (or `/tts`) once to bring Keking into a voice channel; while it stays connected, AI replies are spoken there. `/leave` disconnects.

Chat requires an OpenAI-compatible chat-completions endpoint. Model routing:

- Normal chat: `AI_MODEL` first, then `AI_FALLBACK_MODEL`, then `AI_PREMIUM_MODEL`
- Image attachments: `AI_VISION_MODEL`
- Explicit image-generation requests: `AI_IMAGE_MODEL`

- `AI_API_KEY` - API key; chat is disabled when unset
- `AI_BASE_URL` - endpoint base, default `https://api.openai.com/v1`
- `AI_MODEL` - primary chat model, default `minimax-m3.1-flash`
- `AI_FALLBACK_MODEL` - fallback chat model, default `mimo-v2.6-flash`
- `AI_PREMIUM_MODEL` - last-resort premium model, default `deepseek-v4.1-flash-1017`
- `AI_VISION_MODEL` - image-understanding model, default `qwen3.8-flash-next`
- `AI_IMAGE_MODEL` - image-generation model, default `qwen-image-2.1`
- `AI_MAX_TOKENS` - reply token cap, default `1200` to accommodate reasoning models
- `AI_REASONING_EFFORT` - reasoning budget sent to the provider, default `minimal`. Low effort keeps replies fast and stops the model from spending the whole token cap on reasoning before it writes anything.

Conversation memory is persisted per user per server in PostgreSQL: the last 24 messages (12 exchanges), capped at 12,000 characters. It follows the user across channels and survives restarts. Use `/forget` to clear your own memory; Manage Server admins or the bot owner can clear another user’s memory or use `/forget all`. Rows older than `AI_MEMORY_RETENTION_DAYS` (default `30`) are pruned at startup and daily. Deleting the guild record also removes its AI memory.

This is a fan roleplay and is not affiliated with HoYoverse.

## TTS Voice (ElevenLabs, optional)

Keking uses Google Translate TTS by default. To use an ElevenLabs voice instead:

1. Create an ElevenLabs account.
2. Create an original anime-style voice with Voice Design, or choose a voice whose license permits your use.
3. Copy its voice ID.
4. Set `ELEVENLABS_ENABLED=true`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_VOICE_ID` in `.env`, then restart.

Optional settings:

- `ELEVENLABS_ENABLED` - default `false`; set to `true` to use ElevenLabs instead of Google Translate TTS
- `ELEVENLABS_MODEL_ID` - default `eleven_multilingual_v2` (supports Indonesian)

The ElevenLabs free plan is **non-commercial** and requires attribution. Keking does not add an attribution line; use a paid plan or verify that your use complies with ElevenLabs’ terms. Do not use unofficial Keqing voice clones.

If ElevenLabs is not configured or the voice ID is missing, Keking falls back to Google Translate TTS.

## Gateway Intents

The bot currently initializes with these intents:

- `Guilds`
- `GuildVoiceStates`
- `GuildMessages`
- `MessageContent`

`MessageContent` is used for:

- social-link preview replies
- AI chat mentions and replies to bot messages

The current repo does not implement a Presence-based feature.

## Environment Variables

Create a `.env` file based on `.env.example`.

Required:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`

Optional:

- `DISCORD_GUILD_ID` - deploy commands to a single guild for faster iteration
- `MUSIC_ENABLED` - set to `true` to load music playback commands (default: `false`; `/tts` is always loaded)
- `AI_API_KEY` - OpenAI-compatible API key for Keqing chat
- `AI_BASE_URL` - chat-completions base URL (default: `https://api.openai.com/v1`)
- `AI_MODEL` - primary chat model (default: `minimax-m3.1-flash`)
- `AI_FALLBACK_MODEL` - fallback chat model (default: `mimo-v2.6-flash`)
- `AI_PREMIUM_MODEL` - premium fallback model (default: `deepseek-v4.1-flash-1017`)
- `AI_VISION_MODEL` - model for image attachments (default: `qwen3.8-flash-next`)
- `AI_IMAGE_MODEL` - model for explicit image generation (default: `qwen-image-2.1`)
- `AI_MAX_TOKENS` - maximum reply tokens (default: `1200`)
- `AI_REASONING_EFFORT` - provider reasoning budget (default: `minimal`)
- `AI_MEMORY_RETENTION_DAYS` - delete AI memory older than this many days (default: `30`)
- `ELEVENLABS_ENABLED` - set to `true` to use ElevenLabs TTS (default: `false`, Google Translate TTS)
- `ELEVENLABS_API_KEY` - optional ElevenLabs API key
- `ELEVENLABS_VOICE_ID` - required with the API key when ElevenLabs is enabled
- `ELEVENLABS_MODEL_ID` - ElevenLabs model (default: `eleven_multilingual_v2`)
- `DATABASE_URL` - enable PostgreSQL storage
- `POSTGRES_DB` - used by the bundled Docker Compose database
- `POSTGRES_USER` - used by the bundled Docker Compose database
- `POSTGRES_PASSWORD` - used by the bundled Docker Compose database
- `YOUTUBE_COOKIES` - cookies string used by the YouTube extractor

Example:

```env
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-client-id
DISCORD_GUILD_ID=optional-guild-id-for-faster-command-deploy
MUSIC_ENABLED=false
AI_API_KEY=your-openai-compatible-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=minimax-m3.1-flash
AI_FALLBACK_MODEL=mimo-v2.6-flash
AI_PREMIUM_MODEL=deepseek-v4.1-flash-1017
AI_VISION_MODEL=qwen3.8-flash-next
AI_IMAGE_MODEL=qwen-image-2.1
AI_MAX_TOKENS=1200
AI_REASONING_EFFORT=minimal
AI_MEMORY_RETENTION_DAYS=30
ELEVENLABS_ENABLED=false
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_VOICE_ID=your-voice-id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
DATABASE_URL=postgresql://postgres:password@localhost:5432/keking
POSTGRES_DB=keking
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
YOUTUBE_COOKIES=youtube-cookies-string
```

## Local Development

Install dependencies:

```bash
bun install
```

Run in watch mode:

```bash
bun run dev
```

Run tests and the coverage gate:

```bash
bun test
bun run test:coverage
```

Build:

```bash
bun run build
```

Start the compiled bot:

```bash
bun run start
```

## Slash Command Deployment

Deploy commands:

```bash
bun run deploy:commands
```

After deployment, run the smoke test:

```bash
bun run smoke
```

It verifies the database schema and that the expected 12 commands are registered in the configured scope.

Clear deployed commands:

```bash
bun run deploy:clear-commands
```

If `DISCORD_GUILD_ID` is set, command deployment can target a single guild for faster updates.

## Docker

This repo includes:

- a multi-stage `Dockerfile`
- a `docker-compose.yml` stack for the bot and PostgreSQL
- restart policies
- a Postgres healthcheck before the bot starts

Start the stack:

```bash
bun run docker:up
```

Check logs:

```bash
bun run docker:logs
```

Stop the stack:

```bash
bun run docker:down
```

If `DATABASE_URL` is omitted in Docker Compose, it defaults to the bundled `db` service.

## Stored Data

When `DATABASE_URL` is configured, the bot stores limited guild-level operational data:

- guild ID
- guild name
- command deployment hash
- AI chat memory (last 24 messages per user per server)
- social-preview settings
- join timestamp
- update timestamp

Social-preview message text is not stored. AI chat memory is persistent until `/forget` or guild deletion; see the AI Chat section.

## Docs

Markdown docs:

- deployment guide: [`DEPLOYMENT.md`](./DEPLOYMENT.md)

Static docs live in [`docs/`](./docs), including:

- landing page: [`docs/index.html`](./docs/index.html)
- command reference: [`docs/commands.html`](./docs/commands.html)
- development guide: [`docs/development.html`](./docs/development.html)
- privacy policy: [`docs/privacy.html`](./docs/privacy.html)

## License

This project is licensed under the ISC License.

## Notes

- The bot syncs guild records and deploys commands when joining a guild.
- Voice playback depends on system/runtime voice dependencies being available.
- For managed Postgres providers, point `DATABASE_URL` at the external database and ignore the local `db` service.
