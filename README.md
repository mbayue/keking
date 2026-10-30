# Keking

Keking is a Discord bot built with `discord.js` and TypeScript. It focuses on music playback, text-to-speech, social-link preview helpers, and a small set of utility and admin commands.

## Features

- Music playback from YouTube links, Spotify links, and search queries
- Queue controls: play, skip, pause, resume, stop, shuffle, remove, clear, loop
- Lyrics lookup through Genius
- Text-to-speech playback in voice channels
- Social-link preview helpers for X/Twitter, Instagram, Facebook, and Reddit links
- NovelPia search via `/pia`
- Utility commands such as `/help`, `/ping`, and `/server`
- Admin health commands such as `/botstats` and `/guildinfo`
- Optional PostgreSQL storage for guild-level operational data
- Docker-based local or production deployment

## Tech Stack

- Bun 1.2+
- TypeScript
- `discord.js`
- `discord-player`
- `@discordjs/voice`
- PostgreSQL (`pg`)
- Docker / Docker Compose

## Commands

### Utility

- `/help` - list available commands
- `/ping` - show gateway latency
- `/server` - show basic server info

### Music

- `/play` - play a track from a URL
- `/search` - search for a track and pick from buttons
- `/queue` - show the current queue
- `/now` - show the current track
- `/pause` - pause playback
- `/resume` - resume playback
- `/skip` - skip the current track
- `/stop` - stop playback and clear the queue
- `/leave` - disconnect from voice
- `/shuffle` - shuffle the queue
- `/remove` - remove a track from the queue
- `/clear` - clear queued tracks
- `/loop` - change repeat mode
- `/lyrics` - fetch lyrics for the current or requested song
- `/tts` - play text-to-speech in voice

### Integrations

- `/pia` - search NovelPia titles

### Admin

- `/botstats` - show uptime, memory, ping, and voice dependency health
- `/guildinfo` - show guild and deployment info

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

## Gateway Intents

The bot currently initializes with these intents:

- `Guilds`
- `GuildVoiceStates`
- `GuildMessages`
- `MessageContent`

`MessageContent` is used for:

- social-link preview replies
- mention-based message replies

The current repo does not implement a Presence-based feature.

## Environment Variables

Create a `.env` file based on `.env.example`.

Required:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`

Optional:

- `DISCORD_GUILD_ID` - deploy commands to a single guild for faster iteration
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
- join timestamp
- update timestamp

It does not intentionally store message-content history in the database as part of normal operation.

## Docs

Static docs live in [`docs/`](./docs), including:

- landing page: [`docs/index.html`](./docs/index.html)
- command reference: [`docs/commands.html`](./docs/commands.html)
- privacy policy: [`docs/privacy.html`](./docs/privacy.html)

## License

This project is licensed under the ISC License.

## Notes

- The bot syncs guild records and deploys commands when joining a guild.
- Voice playback depends on system/runtime voice dependencies being available.
- For managed Postgres providers, point `DATABASE_URL` at the external database and ignore the local `db` service.
