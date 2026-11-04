import { config } from "../src/config.js";
import { deployCommands, formatDeployReport } from "../src/utils/deploy-commands.js";

const resolvedGuildId = config.guildId ? config.guildId : null;
let deployResult = { count: 0, skipped: false, hash: "", commandNames: [] as string[] };

try {
  deployResult = await deployCommands({ guildId: resolvedGuildId });
} catch (error) {
  console.error("Error deploying commands:", error);
  process.exit(1);
}
console.log(
  formatDeployReport(deployResult, resolvedGuildId),
);
