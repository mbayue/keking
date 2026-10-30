import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectSourceDirectory = path.resolve(currentDirectory, "..");

function isLoadableFile(fileName: string): boolean {
  if (fileName.endsWith(".d.ts")) {
    return false;
  }

  return fileName.endsWith(".ts") || fileName.endsWith(".js");
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const resolvedPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return walk(resolvedPath);
      }

      return isLoadableFile(entry.name) ? [resolvedPath] : [];
    }),
  );

  return files.flat();
}

export async function importModulesFrom(relativeDirectory: string): Promise<unknown[]> {
  const targetDirectory = path.join(projectSourceDirectory, relativeDirectory);
  const filePaths = await walk(targetDirectory);

  return Promise.all(
    filePaths
      .toSorted((left, right) => left.localeCompare(right))
      .map(async (filePath) => import(pathToFileURL(filePath).href)),
  );
}
