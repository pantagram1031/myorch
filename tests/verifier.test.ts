import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateClaudeCommandFrontmatter,
  validateUtf8NoBomLf,
  validateFrontmatter,
  validateJsonSchema,
  validateRuleFrontmatter
} from "../src/verifier.js";

test("verifier validates Claude command frontmatter with description", () => {
  const result = validateClaudeCommandFrontmatter("---\ndescription: Run current verifier\nargument-hint: \"[task]\"\nallowed-tools: Bash(node *)\nmodel: inherit\n---\n# /next\n");

  assert.equal(result.ok, true);
});

test("verifier rejects paths field in Claude command frontmatter", () => {
  const result = validateClaudeCommandFrontmatter("---\npaths:\n  - src/**/*.ts\n---\n# /bad\n");

  assert.equal(result.ok, false);
  assert.match(result.message, /description|required|paths/i);
});

test("verifier validates rule frontmatter paths array", () => {
  const result = validateRuleFrontmatter("---\npaths:\n  - src/**/*.ts\n---\n# Rule\n");

  assert.equal(result.ok, true);
});

test("verifier accepts CRLF rule frontmatter", () => {
  const result = validateRuleFrontmatter("---\r\npaths:\r\n  - src/**/*.ts\r\n---\r\n# Rule\r\n");

  assert.equal(result.ok, true);
});

test("verifier rejects malformed frontmatter", () => {
  const result = validateFrontmatter("---\npaths: src/**/*.ts\n---\n# Rule\n");

  assert.equal(result.ok, false);
  assert.match(result.message, /paths/i);
});

test("verifier rejects UTF-8 BOM and CRLF for Claude integration files", () => {
  assert.equal(validateUtf8NoBomLf(Buffer.from("\uFEFF---\ndescription: Bad\n---\n")).ok, false);
  assert.equal(validateUtf8NoBomLf(Buffer.from("---\r\ndescription: Bad\r\n---\r\n")).ok, false);
  assert.equal(validateUtf8NoBomLf(Buffer.from("---\ndescription: Good\n---\n")).ok, true);
});

test("verifier validates JSON schema", () => {
  const result = validateJsonSchema(
    { type: "object", required: ["model"], properties: { model: { enum: ["claude", "codex"] } } },
    { model: "codex" }
  );

  assert.equal(result.ok, true);
});

const v2CriticalRules = [
  "토큰 효율 최우선. 모드별 정책 엄수.",
  "70%+ 모드에서 Claude 호출 금지 (verification-exception 예산 내 제외).",
  "5h 블록 리셋 자동 감지, low confidence는 사용자 confirm 대기.",
  "OSS 설치 전 별도 branch + verify:all 통과 + protected paths 영향 없음 확인.",
  "모든 자율 결정 침묵 금지. 10종 jsonl에 기록."
];

test(".claude/myorch.md includes v2 critical rules", () => {
  const content = readFileSync(".claude/myorch.md", "utf8");

  for (const rule of v2CriticalRules) {
    assert.match(content, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("CLAUDE.md includes v2 critical rules and stays within 120 lines", () => {
  const content = readFileSync("CLAUDE.md", "utf8");

  for (const rule of v2CriticalRules) {
    assert.match(content, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.ok(content.split("\n").length <= 120);
});
