import "dotenv/config";

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const config = {
  token: getEnv("DISCORD_TOKEN"),
  clientId: getEnv("DISCORD_CLIENT_ID"),
  guildId: process.env.DISCORD_GUILD_ID,
  databaseUrl: process.env.DATABASE_URL,
  ytCookies: process.env.YOUTUBE_COOKIES || '',
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  facebookScraperDomain: process.env.FACEBOOK_SCRAPER_DOMAIN || "xfa.gsdm.site",
  redditScraperDomain: process.env.REDDIT_SCRAPER_DOMAIN || "xrd.gsdm.site",
  botOwnerId: process.env.BOT_OWNER_ID || "330320305606230016",
};
