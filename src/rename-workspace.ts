import fs from "node:fs";
import path from "node:path";
import glob from "fast-glob";
import ignore from "ignore";

async function renameWorkspace(
  oldName: string,
  oldNameCapitalized: string,
  newName: string,
  newNameCapitalized: string,
  rootDir: string
) {
  console.log(`oldName: ${oldName}`);
  console.log(`oldNameCapitalized: ${oldNameCapitalized}`);
  console.log(`newName: ${newName}`);
  console.log(`newNameCapitalized: ${newNameCapitalized}`);

  let oldNameCapitalizedParts = oldNameCapitalized.split(":");

  let mappings = [oldName, ...oldNameCapitalizedParts].map((name, index) => {
    return {
      old: name,
      new: index === 0 ? newName : newNameCapitalized,
    };
  });

  const gitignorePath = path.join(rootDir, ".gitignore");
  const gitignore = fs.existsSync(gitignorePath)
    ? ignore().add(fs.readFileSync(gitignorePath, "utf8"))
    : null;

  // Gather all directories and files in the workspace
  let entries = await glob(["**/*"], {
    cwd: rootDir,
    onlyFiles: false,
    ignore: ["node_modules", "**/node_modules"],
    absolute: true,
  });

  // Rename folders
  for (const entry of entries) {
    const parentDir = path.dirname(entry);
    const baseName = path.basename(entry);

    if (gitignore && gitignore.ignores(path.relative(rootDir, entry))) continue;

    let newBaseName = baseName;
    for (const mapping of mappings) {
      if (baseName.includes(mapping.old)) {
        newBaseName = newBaseName.replace(
          new RegExp(mapping.old, "g"),
          mapping.new
        );
      }
    }

    if (baseName !== newBaseName) {
      const newPath = path.join(parentDir, newBaseName);
      fs.renameSync(entry, newPath);
      console.log(`Renamed ${entry} to ${newPath}`);
    }
  }

  // reglob entries in case paths have changed
  entries = await glob(["**/*"], {
    cwd: rootDir,
    onlyFiles: false,
    ignore: ["node_modules", "**/node_modules"],
    absolute: true,
  });

  // Replace strings in .ts, .json files
  const files = entries.filter(
    (entry) =>
      entry.endsWith(".ts") ||
      entry.endsWith(".json") ||
      entry.endsWith(".tsx") ||
      entry.endsWith("pnpm-workspace.yaml") ||
      entry.endsWith(".code-workspace") ||
      entry.endsWith(".toml") ||
      entry.match(/\.md$/i)
  );
  for (const file of files) {
    if (gitignore && gitignore.ignores(path.relative(rootDir, file))) continue;

    const content = fs.readFileSync(file, "utf8");
    let updatedContent = content;
    //   .replace(new RegExp(oldName, "g"), newName)
    //   .replace(new RegExp(oldNameCapitalized, "g"), newNameCapitalized);

    for (const mapping of mappings) {
      updatedContent = updatedContent.replace(
        new RegExp(mapping.old, "g"),
        mapping.new
      );
    }

    if (content !== updatedContent) {
      fs.writeFileSync(file, updatedContent);
      console.log(`Updated ${file}`);
    }
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Entry point
(async () => {
  const args = process.argv.slice(2);
  if (args.length < 5) {
    console.error(
      "Usage: ts-node rename-workspace.ts <oldName> <newName> <oldNameCapitalized> <newNameCapitalized> <rootDir>"
    );
    process.exit(1);
  }

  const [oldName, oldNameCapitalized, newName, newNameCapitalized, rootDir] =
    args;

  try {
    await renameWorkspace(
      oldName,
      oldNameCapitalized,
      newName,
      newNameCapitalized,
      rootDir
    );
    console.log("Workspace renamed successfully!");
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();
