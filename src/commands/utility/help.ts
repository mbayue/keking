import { MessageFlags, SlashCommandBuilder, type InteractionReplyOptions } from "discord.js";
import { config } from "../../config.js";
import type { SlashCommand } from "../../structures/command.js";
import { createInfoEmbed } from "../../utils/embeds.js";

const MUSIC_COMMANDS =
  "`/join`, `/clear`, `/leave`, `/loop`, `/lyrics`, `/now`, `/pause`, `/play`, `/queue`, `/remove`, `/resume`, `/search`, `/shuffle`, `/skip`, `/stop`, `/tts`";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows the available commands included in this bot."),
  async execute(interaction) {
    const embed = createInfoEmbed({
      title: "Available Commands",
      fields: [
        { name: "Utility", value: "`/forget`, `/help`, `/ping`, `/server`" },
        {
          name: "Music",
          value: config.musicEnabled
            ? MUSIC_COMMANDS
            : "`/join`, `/leave`, `/tts` (music playback is temporarily disabled)",
        },
        { name: "AI", value: "Mention Keking or reply to one of its messages to chat with Keqing. Ask casually for a channel recap with “summarize this conversation” or “ringkas percakapan ini”. If Keking is in voice, it speaks the reply aloud." },
        { name: "Integrations", value: "`/pia`" },
        { name: "Admin", value: "`/ai`, `/bottalk`, `/botstats`, `/guildinfo`, `/social-preview`" },
      ],
    });

    const reply = {
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    } satisfies InteractionReplyOptions;

    await interaction.reply(reply);
  },
};
