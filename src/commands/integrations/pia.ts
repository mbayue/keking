import {
  EmbedBuilder,
  type InteractionEditReplyOptions,
  MessageFlags,
  SlashCommandBuilder,
  type InteractionReplyOptions,
} from "discord.js";

import { searchNovels } from "../../api/pia.js";
import type { SlashCommand } from "../../structures/command.js";
import { createErrorEmbed, createInfoEmbed } from "../../utils/embeds.js";

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function toDate(value: string): Date | null {
  const normalized = value.replace(" ", "T");
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("pia")
    .setDescription("Searches novels from NovelPia.")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Keyword to search for")
        .setRequired(true),
    ),
  async execute(interaction) {
    const query = interaction.options.getString("query", true).trim();

    await interaction.deferReply();

    try {
      const novels = await searchNovels(query);

      if (novels.length === 0) {
        await interaction.editReply({
          embeds: [createErrorEmbed("No Results", `No NovelPia results found for \`${query}\`.`)],
        });
        return;
      }

      const firstNovel = novels[0];
      const otherNovels = novels.slice(1);

      if (!firstNovel) {
        await interaction.editReply({
          embeds: [createErrorEmbed("No Results", `No NovelPia results found for \`${query}\`.`)],
        });
        return;
      }

      const embed = createInfoEmbed({
        title: firstNovel.title,
        description: truncate(firstNovel.description || "No description provided.", 400),
        fields: [
          { name: "Author", value: firstNovel.author || "Unknown", inline: true },
          { name: "Locale", value: firstNovel.locale || "Unknown", inline: true },
          {
            name: "Status",
            value: firstNovel.isComplete ? "Complete" : "Ongoing",
            inline: true,
          },
          { name: "Episodes", value: firstNovel.episodes.toString(), inline: true },
          { name: "Likes", value: firstNovel.likes.toString(), inline: true },
          { name: "Views", value: firstNovel.views.toString(), inline: true },
        ],
      })
        .setURL(firstNovel.url)
        .setThumbnail(firstNovel.imageUrl)
        .setFooter({
          text: firstNovel.tags.length > 0 ? `Tags: ${firstNovel.tags.slice(0, 5).join(", ")}` : "No tags",
        });

      const moreResults = otherNovels
        .slice(0, 4)
        .map((novel, index) => `${index + 2}. [${novel.title}](${novel.url}) by ${novel.author}`)
        .join("\n");

      if (moreResults) {
        embed.addFields({
          name: "More Results",
          value: moreResults,
        });
      }

      const updatedAt = firstNovel.updatedAt ? toDate(firstNovel.updatedAt) : null;

      if (updatedAt) {
        embed.setTimestamp(updatedAt);
      }

      const reply: InteractionEditReplyOptions = {
        embeds: [embed],
      };

      if (firstNovel.isAdult) {
        reply.content = "Warning: top result is marked adult.";
      }

      await interaction.editReply(reply);
    } catch (error) {
      console.error("NovelPia search failed:", error);

      const reply = {
        embeds: [createErrorEmbed("NovelPia Error", "NovelPia search failed. Please try again in a moment.")],
        flags: MessageFlags.Ephemeral,
      } satisfies InteractionReplyOptions;

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: reply.embeds });
        return;
      }

      await interaction.reply(reply);
    }
  },
};
