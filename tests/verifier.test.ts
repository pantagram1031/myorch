import test from "node:test";
import assert from "node:assert/strict";
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
