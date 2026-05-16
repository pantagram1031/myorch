export interface RatchetTask {
  index: number;
  lineIndex: number;
  checked: boolean;
  current: boolean;
  title: string;
  verifier?: string;
}

export interface ParsedPlan {
  tasks: RatchetTask[];
}

export interface RatchetResult {
  advanced: boolean;
  complete: boolean;
  content: string;
  evidence: string;
}

const CHECKBOX_RE = /^(\s*)-\s\[( |x|X)\]\s*(?:(← current)\s*)?(.*)$/;
const VERIFIER_RE = /Verifier:\s*`([^`]+)`/i;

export function parsePlan(content: string): ParsedPlan {
  const lines = content.split(/\r?\n/);
  const tasks: RatchetTask[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(CHECKBOX_RE);
    if (!match) continue;
    const task: RatchetTask = {
      index: tasks.length,
      lineIndex: i,
      checked: match[2].toLowerCase() === "x",
      current: Boolean(match[3]),
      title: match[4].trim()
    };

    for (let j = i + 1; j < lines.length; j++) {
      if (CHECKBOX_RE.test(lines[j])) break;
      const verifier = lines[j].match(VERIFIER_RE);
      if (verifier) {
        task.verifier = verifier[1];
        break;
      }
    }

    tasks.push(task);
  }

  return { tasks };
}

export function advanceRatchet(content: string, verifier: { passed: boolean; evidence: string }): RatchetResult {
  if (!verifier.passed) {
    return { advanced: false, complete: false, content, evidence: verifier.evidence };
  }

  const lines = content.split(/\r?\n/);
  const parsed = parsePlan(content);
  const current = parsed.tasks.find((task) => task.current && !task.checked)
    ?? parsed.tasks.find((task) => !task.checked);

  if (!current) {
    return { advanced: false, complete: true, content, evidence: verifier.evidence };
  }

  lines[current.lineIndex] = markLineChecked(lines[current.lineIndex]);
  const next = parsed.tasks.find((task) => task.index > current.index && !task.checked);
  if (next) {
    lines[next.lineIndex] = markLineCurrent(lines[next.lineIndex]);
  }

  return {
    advanced: true,
    complete: !next,
    content: lines.join("\n"),
    evidence: verifier.evidence
  };
}

function markLineChecked(line: string): string {
  return line.replace(/^(\s*)-\s\[\s\]\s*(?:← current\s*)?/, "$1- [x] ");
}

function markLineCurrent(line: string): string {
  if (line.includes("← current")) return line;
  return line.replace(/^(\s*)-\s\[\s\]\s*/, "$1- [ ] ← current ");
}
