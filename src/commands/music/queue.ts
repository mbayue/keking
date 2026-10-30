import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { SlashCommand } from "../../structures/command.js";
import { getPlayer } from "../../utils/music.js";
import { createInfoEmbed } from "../../utils/embeds.js";

const PAGE_SIZE = 10;

function buildQueueEmbed(current: string | null, queue: string[], page: number) {
  const totalPages = Math.max(1, Math.ceil(queue.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const pageTracks = queue.slice(startIndex, startIndex + PAGE_SIZE);

  let description = "";
  if (current) {
    description += `**Now Playing:** ${current}\n\n`;
  } else {
    description += "No track is currently playing.\n\n";
  }

  if (queue.length > 0) {
    description += `**Queue (Page ${page}/${totalPages}):**\n`;
    description += pageTracks
      .map((track, index) => `${startIndex + index + 1}. ${track}`)
      .join("\n");
  } else {
    description += "The queue is empty.";
  }

  return createInfoEmbed({
    title: "🎵 Music Queue",
    description,
  });
}

export const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current music queue"),
  async execute(interaction) {
    const player = getPlayer(interaction.guildId!);
    const queue = player.getQueue();
    const current = player.getCurrentTrack();
    const totalPages = Math.max(1, Math.ceil(queue.length / PAGE_SIZE));
    let page = 1;

    const embed = buildQueueEmbed(current, queue, page);
    const row = new ActionRowBuilder<ButtonBuilder>();

    if (totalPages > 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("queue_prev")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("queue_next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
      );
    }

    const response = await interaction.reply({
      embeds: [embed],
      components: totalPages > 1 ? [row] : [],
      withResponse: true,
    });
    const reply = response.resource?.message;
    if (!reply) {
      return;
    }

    if (totalPages <= 1) {
      return;
    }

    const collector = reply.createMessageComponentCollector({
      time: 30_000,
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: "❌ Only the user who requested the queue can change pages.",
          ephemeral: true,
        });
        return;
      }

      if (buttonInteraction.customId === "queue_prev") {
        page = Math.max(1, page - 1);
      } else if (buttonInteraction.customId === "queue_next") {
        page = Math.min(totalPages, page + 1);
      }

      const nextEmbed = buildQueueEmbed(current, queue, page);
      const prevButton = new ButtonBuilder()
        .setCustomId("queue_prev")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 1);
      const nextButton = new ButtonBuilder()
        .setCustomId("queue_next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === totalPages);

      await buttonInteraction.update({
        embeds: [nextEmbed],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton),
        ],
      });
    });

    collector.on("end", async () => {
      const disabledPrev = new ButtonBuilder()
        .setCustomId("queue_prev")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true);
      const disabledNext = new ButtonBuilder()
        .setCustomId("queue_next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true);

      await reply.edit({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(disabledPrev, disabledNext),
        ],
      }).catch(() => {});
    });
  },
};
