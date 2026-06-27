import { MessageFlags, SlashCommandBuilder, type InteractionReplyOptions } from "discord.js";
import type { SlashCommand } from "../../structures/command.js";
import { createInfoEmbed } from "../../utils/embeds.js";

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows the available commands included in this bot."),
  async execute(interaction) {
    const embed = createInfoEmbed({
      title: "Available Commands",
      fields: [
        { name: "Utility", value: "`/help`, `/ping`, `/server`" },
        {
          name: "Music",
          value:
            "`/clear`, `/leave`, `/loop`, `/lyrics`, `/now`, `/pause`, `/play`, `/queue`, `/remove`, `/resume`, `/search`, `/shuffle`, `/skip`, `/stop`, `/tts`",
        },
        { name: "Integrations", value: "`/pia`" },
        { name: "Admin", value: "`/botstats`, `/guildinfo`, `/social-preview`" },
      ],
    });

    const reply = {
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    } satisfies InteractionReplyOptions;

    await interaction.reply(reply);
  },
};
