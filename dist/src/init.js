import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildClaudeSettings } from "./enforcement.js";
const CLAUDE_IMPORT = "@.claude/myorch.md";
const MYORCH_IGNORE = [
    "",
    "# myorch runtime state",
    ".myorch/memory/",
    ".myorch/backups/",
    ".myorch/handover/",
    ".myorch/cache/",
    ".myorch/scenarios/",
    ".claude/debug/",
    ".claude/myorch.local.md"
];
const ROADMAP_SEED = `# ROADMAP

## Priority 1 - Efficiency

- [ ] Apply token percent policy automatically.

### Success criteria

- [ ]

- [ ] Detect 5h block reset and restore Claude authority.

### Success criteria

- [ ]

- [ ] Decide reasoning level autonomously.

### Success criteria

- [ ]

- [ ] Measure metareview ROI.

### Success criteria

- [ ]

## Priority 2 - Autonomous Operation

- [ ] Generate autonomous /goal loop.

### Success criteria

- [ ]

- [ ] Add token guard, automatic sleep, and resume.

### Success criteria

- [ ]

- [ ] Explore OSS candidates and sandbox-install safe matches.

### Success criteria

- [ ]

- [ ] Record every autonomous decision.

### Success criteria

- [ ]

## Priority 3 - Real-World Usability

- [ ] Automatically verify Quick Start in a fresh environment.

### Success criteria

- [ ]

- [ ] Verify npm install after public transition.

### Success criteria

- [ ]

- [ ] Keep demo gif placeholder for manual recording.

### Success criteria

- [ ]

## Priority 4 - Expansion

- [ ] Add macOS/Linux compatibility.

### Success criteria

- [ ]

- [ ] Add myorch update command.

### Success criteria

- [ ]

- [ ] Refresh ARCHITECTURE diagrams.

### Success criteria

- [ ]
`;
const PROTECTED_PATHS_SEED = {
    files: [
        "src/router.ts",
        "src/ratchet.ts",
        "src/enforcement.ts",
        "src/handoff.ts",
        "src/token-guard.ts",
        ".claude/settings.json"
    ],
    packageJsonSections: ["bin", "scripts", "prepare"]
};
export async function initProject(root, options = {}) {
    const result = { created: [], skipped: [], updated: [] };
    const source = await findPackageRoot();
    await mkdir(join(root, ".claude"), { recursive: true });
    await mkdir(join(root, ".myorch", "memory"), { recursive: true });
    await mkdir(join(root, ".myorch", "backups"), { recursive: true });
    await mkdir(join(root, ".myorch", "handover"), { recursive: true });
    result.created.push(".myorch/memory", ".myorch/backups", ".myorch/handover");
    await seedFile(join(root, "ROADMAP.md"), ROADMAP_SEED, result, options.force === true);
    await seedFile(join(root, ".myorch", "protected-paths.json"), JSON.stringify(PROTECTED_PATHS_SEED, null, 2) + "\n", result, options.force === true);
    await copyDir(join(source, ".claude", "commands"), join(root, ".claude", "commands"), result, options.force === true);
    await copyDir(join(source, ".claude", "rules"), join(root, ".claude", "rules"), result, options.force === true);
    await copyDir(join(source, ".claude", "hooks"), join(root, ".claude", "hooks"), result, options.force === true);
    await copyFileOwned(join(source, ".claude", "statusline.sh"), join(root, ".claude", "statusline.sh"), result, options.force === true);
    await copyFileOwned(join(source, ".claude", "myorch.md"), join(root, ".claude", "myorch.md"), result, true);
    await mergeSettings(root, result, options.force === true);
    await ensureClaudeImport(root, result);
    await mergeGitignore(root, result);
    return result;
}
async function copyDir(source, target, result, force) {
    await mkdir(target, { recursive: true });
    for (const file of await safeReaddir(source)) {
        const sourcePath = join(source, file);
        const targetPath = join(target, file);
        const entry = await stat(sourcePath);
        if (entry.isDirectory()) {
            await copyDir(sourcePath, targetPath, result, force);
        }
        else {
            await copyFileOwned(sourcePath, targetPath, result, force);
        }
    }
}
async function copyFileOwned(source, target, result, force) {
    const exists = await pathExists(target);
    if (exists && !force) {
        result.skipped.push(relativeDisplay(target));
        return;
    }
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { force: true });
    (exists ? result.updated : result.created).push(relativeDisplay(target));
}
async function seedFile(target, content, result, force) {
    const exists = await pathExists(target);
    if (exists && !force) {
        result.skipped.push(relativeDisplay(target));
        return;
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    (exists ? result.updated : result.created).push(relativeDisplay(target));
}
async function mergeSettings(root, result, force) {
    const target = join(root, ".claude", "settings.json");
    const desired = buildClaudeSettings();
    if (!(await pathExists(target)) || force) {
        await writeFile(target, JSON.stringify(desired, null, 2) + "\n", "utf8");
        result.created.push(".claude/settings.json");
        return;
    }
    let current;
    try {
        current = JSON.parse(await readFile(target, "utf8"));
    }
    catch {
        result.skipped.push(".claude/settings.json");
        return;
    }
    const merged = mergeHookSettings(current, desired);
    await writeFile(target, JSON.stringify(merged, null, 2) + "\n", "utf8");
    result.updated.push(".claude/settings.json");
}
function mergeHookSettings(current, desired) {
    const output = { ...current };
    const currentHooks = asRecord(output.hooks) ?? {};
    const desiredHooks = asRecord(desired.hooks) ?? {};
    const hooks = { ...currentHooks };
    for (const [event, groups] of Object.entries(desiredHooks)) {
        const existing = Array.isArray(hooks[event]) ? hooks[event] : [];
        const incoming = Array.isArray(groups) ? groups : [];
        const existingText = JSON.stringify(existing);
        hooks[event] = [
            ...existing,
            ...incoming.filter((group) => !existingText.includes(commandSignature(group)))
        ];
    }
    output.hooks = hooks;
    if (!output.statusLine)
        output.statusLine = desired.statusLine;
    return output;
}
async function ensureClaudeImport(root, result) {
    const file = join(root, "CLAUDE.md");
    const current = await readOptional(file);
    if (current.includes(CLAUDE_IMPORT)) {
        result.skipped.push("CLAUDE.md");
        return;
    }
    const next = current.trimEnd()
        ? `${current.trimEnd()}\n\n${CLAUDE_IMPORT}\n`
        : `${CLAUDE_IMPORT}\n`;
    await writeFile(file, next, "utf8");
    (current ? result.updated : result.created).push("CLAUDE.md");
}
async function mergeGitignore(root, result) {
    const file = join(root, ".gitignore");
    const current = await readOptional(file);
    const lines = new Set(current.split(/\r?\n/).map((line) => line.trim()));
    const missing = MYORCH_IGNORE.filter((line) => line === "" || !lines.has(line));
    if (missing.filter(Boolean).length === 0) {
        result.skipped.push(".gitignore");
        return;
    }
    const prefix = current.trimEnd() ? `${current.trimEnd()}\n` : "";
    await writeFile(file, `${prefix}${missing.join("\n")}\n`, "utf8");
    (current ? result.updated : result.created).push(".gitignore");
}
async function findPackageRoot() {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
        resolve(here, "..", ".."),
        resolve(here, ".."),
        process.cwd()
    ];
    for (const candidate of candidates) {
        if (await pathExists(join(candidate, ".claude", "commands", "goal.md")))
            return candidate;
    }
    throw new Error("Cannot locate myorch package templates.");
}
async function safeReaddir(path) {
    try {
        return await readdir(path);
    }
    catch {
        return [];
    }
}
async function pathExists(path) {
    try {
        await stat(path);
        return true;
    }
    catch {
        return false;
    }
}
async function readOptional(path) {
    try {
        return await readFile(path, "utf8");
    }
    catch {
        return "";
    }
}
function commandSignature(value) {
    return JSON.stringify(value);
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function relativeDisplay(path) {
    const marker = `${process.cwd()}\\`;
    return path.startsWith(marker) ? path.slice(marker.length) : path;
}
