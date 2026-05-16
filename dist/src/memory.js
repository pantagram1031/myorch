import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
export async function appendMemoryRecord(root, kind, payload) {
    const dir = join(root, ".myorch", "memory");
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${kind}.jsonl`);
    const record = {
        ts: new Date().toISOString(),
        kind,
        ...payload
    };
    await appendFile(file, JSON.stringify(record) + "\n", "utf8");
    return file;
}
