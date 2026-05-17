export interface UsageInsightModelStat {
  model: string;
  tokens: number;
  passCount: number;
  taskCount: number;
}

export interface UsageInsightReasoningStat {
  level: string;
  passCount: number;
  taskCount: number;
}

export interface UsageInsightTransition {
  from: string;
  to: string;
  count: number;
}

export interface UsageInsightMetareview {
  caughtDefects: number;
  reviewedTasks: number;
}

export interface UsageInsightOss {
  accepted: number;
  rejected: number;
  pending: number;
}

export interface UsageInsightInput {
  generatedAt?: string;
  modelStats: UsageInsightModelStat[];
  reasoningStats: UsageInsightReasoningStat[];
  transitions: UsageInsightTransition[];
  metareview: UsageInsightMetareview;
  oss: UsageInsightOss;
}

const USAGE_INSIGHT_FILE_PATTERN = /^usage-insight-(\d{4}-\d{2}-\d{2})\.md$/;

export function renderUsageInsight(input: UsageInsightInput): string {
  const lines = [
    "# Usage Insight",
    ""
  ];

  if (input.generatedAt) {
    lines.push(`_Generated: ${input.generatedAt}_`, "");
  }

  lines.push(
    "## Model Token Efficiency",
    ...input.modelStats.map((stat) => `- ${stat.model}: ${stat.tokens} tokens, ${ratio(stat.passCount, stat.taskCount)} PASS ratio`),
    "",
    "## Reasoning Level Effect",
    ...input.reasoningStats.map((stat) => `- ${stat.level}: ${ratio(stat.passCount, stat.taskCount)} PASS ratio`),
    "",
    "## Permission Transition Patterns",
    ...input.transitions.map((transition) => `- ${transition.from} -> ${transition.to}: ${transition.count}`),
    "",
    "## Metareview ROI",
    `- ${input.metareview.caughtDefects} defects caught across ${input.metareview.reviewedTasks} reviewed tasks (${ratio(input.metareview.caughtDefects, input.metareview.reviewedTasks)} per task)`,
    "",
    "## OSS Adoption",
    `- accepted=${input.oss.accepted}, rejected=${input.oss.rejected}, pending=${input.oss.pending}, adoption=${ratio(input.oss.accepted, totalOss(input.oss))}`,
    ""
  );

  return lines.join("\n");
}

export function usageInsightFilenameForDate(renderDate: string): string {
  return `usage-insight-${renderDate}.md`;
}

export function pickLatestUsageInsightFilename(filenames: string[]): string | undefined {
  return filenames
    .filter((filename) => USAGE_INSIGHT_FILE_PATTERN.test(filename))
    .sort((left, right) => left.localeCompare(right))
    .at(-1);
}

function totalOss(oss: UsageInsightOss): number {
  return oss.accepted + oss.rejected + oss.pending;
}

function ratio(numerator: number, denominator: number): string {
  return denominator === 0 ? "0.00" : (numerator / denominator).toFixed(2);
}
