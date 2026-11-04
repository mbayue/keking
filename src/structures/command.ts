import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

export type CommandData = {
  name: string;
  toJSON: () => RESTPostAPIChatInputApplicationCommandsJSONBody;
};

export type SlashCommand = {
  data: CommandData;
  /** Loaded only when MUSIC_ENABLED=true. TTS is intentionally not gated. */
  requiresMusic?: boolean;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};
