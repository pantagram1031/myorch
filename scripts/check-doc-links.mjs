import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const root = process.cwd();
const markdownFiles = collectMarkdown(root).filter((file) => !ignored(file));
const failures = [];

for (const file of markdownFiles) {
  const content = readFileSync(file, "utf8");
  const links = [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  for (const raw of links) {
    if (/^(https?:|mailto:|#)/i.test(raw)) continue;
    const target = raw.split("#")[0];
    if (!target) continue;
    const full = normalize(join(dirname(file), target));
    if (!existsSync(full)) failures.push(`${relative(file)} -> ${raw}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`checked ${markdownFiles.length} markdown files`);

function collectMarkdown(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "dist", ".myorch"].includes(entry.name) || entry.name.includes(".backup-")) continue;
      files.push(...collectMarkdown(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

function ignored(file) {
  const rel = relative(file).replaceAll("\\", "/");
  return rel === "verification-report.md" || rel === "CLAUDE.local.md";
}

function relative(file) {
  return file.slice(root.length + 1);
}
