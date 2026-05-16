export type FrontmatterValue = string | string[] | boolean;
export type FrontmatterMap = Record<string, FrontmatterValue>;

export function parseFrontmatter(markdown: string): FrontmatterMap {
  const yaml = extractFrontmatter(markdown);
  const result: FrontmatterMap = {};
  let currentKey: string | undefined;

  for (const line of yaml.split("\n")) {
    if (!line.trim()) continue;
    const arrayItem = line.match(/^\s+-\s+(.+)$/);
    if (arrayItem && currentKey) {
      const existing = result[currentKey];
      const values = Array.isArray(existing) ? existing : [];
      values.push(unquote(arrayItem[1].trim()));
      result[currentKey] = values;
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) {
      throw new Error(`Unsupported frontmatter line: ${line}`);
    }

    currentKey = match[1];
    const raw = match[2]?.trim() ?? "";
    result[currentKey] = raw ? parseScalar(raw) : [];
  }

  return result;
}

export function parseFrontmatterPaths(markdown: string): string[] {
  const parsed = parseFrontmatter(markdown);
  const paths = parsed.paths;
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("paths must be a YAML array.");
  }
  return paths;
}

function extractFrontmatter(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error("Missing YAML frontmatter fence.");
  }

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    throw new Error("Missing closing YAML frontmatter fence.");
  }

  return normalized.slice(4, end);
}

function parseScalar(raw: string): FrontmatterValue {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return unquote(raw);
}

function unquote(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}
