import { Collection } from "discord.js";

import { config } from "../config.js";
import type { SlashCommand } from "../structures/command.js";
import { importModulesFrom } from "../utils/load-files.js";

export async function loadCommands(): Promise<Collection<string, SlashCommand>> {
  const modules = await importModulesFrom("commands");
  const commands = new Collection<string, SlashCommand>();

  for (const module of modules) {
    if (!module || typeof module !== "object" || !("command" in module)) {
      continue;
    }

    const command = module.command as SlashCommand | undefined;

    if (!command) {
      continue;
    }

    if (command.requiresMusic && !config.musicEnabled) {
      continue;
    }

    commands.set(command.data.name, command);
  }

  return commands;
}
