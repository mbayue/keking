import type { Client } from "discord.js";
import type { Player } from "discord-player";

import type { SlashCommand } from "../structures/command.js";

export type BotClient = Client & {
  commands: Map<string, SlashCommand>;
  musicPlayer: Player;
};
