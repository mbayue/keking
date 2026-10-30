FROM oven/bun:1-slim AS deps

WORKDIR /app

COPY package.json ./
RUN YOUTUBE_DL_SKIP_PYTHON_CHECK=1 bun install

FROM deps AS runtime

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y \
  ffmpeg \
  yt-dlp \
  libopus0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle

USER bun

CMD ["bun", "src/index.ts"]
