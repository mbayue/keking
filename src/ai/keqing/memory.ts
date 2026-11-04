import {
  getAiChatMemory,
  saveAiChatMemory,
  type StoredChatTurn,
} from "../../db/postgres.js";

const MAX_HISTORY_MESSAGES = 24;
const MAX_HISTORY_CHARS = 12_000;

type LoadMemory = (guildId: string, userId: string) => Promise<StoredChatTurn[]>;
type SaveMemory = (guildId: string, userId: string, turns: StoredChatTurn[]) => Promise<void>;

export async function loadTurns(
  guildId: string,
  userId: string,
  getMemory: LoadMemory = getAiChatMemory,
): Promise<StoredChatTurn[]> {
  try {
    return await getMemory(guildId, userId);
  } catch (error) {
    console.error("[ai] failed to load persistent memory:", error);
    return [];
  }
}

export async function saveTurns(
  guildId: string,
  userId: string,
  turns: StoredChatTurn[],
  saveMemory: SaveMemory = saveAiChatMemory,
): Promise<void> {
  try {
    await saveMemory(guildId, userId, turns);
  } catch (error) {
    console.error("[ai] failed to persist memory:", error);
  }
}

export function trimTurns(turns: StoredChatTurn[]): void {
  while (turns.length > MAX_HISTORY_MESSAGES) {
    turns.shift();
  }

  while (turns[0]?.role === "assistant") {
    turns.shift();
  }

  while (
    turns.reduce((total, turn) => total + turn.content.length, 0) > MAX_HISTORY_CHARS &&
    turns.length > 0
  ) {
    turns.shift();
  }
}
