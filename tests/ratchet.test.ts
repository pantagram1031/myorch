import test from "node:test";
import assert from "node:assert/strict";
import { advanceRatchet, parsePlan } from "../src/ratchet.js";

const samplePlan = [
  "- [x] **Task 1: Done**",
  "  - Verifier: `npm test task1`",
  "- [ ] ← current **Task 2: Current**",
  "  - Verifier: `npm test task2`",
  "- [ ] **Task 3: Next**",
  "  - Verifier: `npm test task3`"
].join("\n");

test("ratchet parses checked, current, and verifier command", () => {
  const parsed = parsePlan(samplePlan);

  assert.equal(parsed.tasks.length, 3);
  assert.equal(parsed.tasks[1].current, true);
  assert.equal(parsed.tasks[1].verifier, "npm test task2");
});

test("ratchet advances exactly one task on PASS", () => {
  const next = advanceRatchet(samplePlan, { passed: true, evidence: "PASS" });
  const parsed = parsePlan(next.content);

  assert.equal(next.advanced, true);
  assert.equal(parsed.tasks[1].checked, true);
  assert.equal(parsed.tasks[2].current, true);
});

test("ratchet refuses to advance on FAIL", () => {
  const next = advanceRatchet(samplePlan, { passed: false, evidence: "FAIL" });

  assert.equal(next.advanced, false);
  assert.equal(next.content, samplePlan);
});
