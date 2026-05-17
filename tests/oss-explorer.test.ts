import test from "node:test";
import assert from "node:assert/strict";
import { evaluateOssCandidate } from "../src/oss-explorer.js";

test("safe dependency-only candidate qualifies for sandbox install", () => {
  const result = evaluateOssCandidate({
    name: "agent-ratchet",
    stars: 100,
    lastCommitDaysAgo: 20,
    license: "MIT",
    dependencyCount: 5,
    auditOk: true,
    touchedPaths: ["package.json"],
    packageJsonSections: ["dependencies"]
  });

  assert.deepEqual(result, {
    action: "sandbox-install",
    reason: "candidate meets sandbox-install criteria with dependency-only package.json changes"
  });
});

test("eligible candidate with non-protected source impact becomes pending merge", () => {
  const result = evaluateOssCandidate({
    name: "usage-insight-addon",
    stars: 80,
    lastCommitDaysAgo: 7,
    license: "Apache-2.0",
    dependencyCount: 8,
    auditOk: true,
    touchedPaths: ["package.json", "src/usage-insight.ts"],
    packageJsonSections: ["dependencies"]
  });

  assert.deepEqual(result, {
    action: "pending-merge",
    reason: "candidate requires review before merge because it changes project source files"
  });
});

test("protected path impact downgrades to protected deferred", () => {
  const result = evaluateOssCandidate({
    name: "router-helper",
    stars: 100,
    lastCommitDaysAgo: 20,
    license: "MIT",
    dependencyCount: 5,
    auditOk: true,
    touchedPaths: ["src/router.ts"]
  });

  assert.deepEqual(result, {
    action: "protected-deferred",
    reason: "candidate touches protected path: src/router.ts"
  });
});

test("protected path impact handles Windows path separators and custom protected paths", () => {
  const windowsResult = evaluateOssCandidate({
    name: "router-helper",
    stars: 100,
    lastCommitDaysAgo: 20,
    license: "MIT",
    dependencyCount: 5,
    auditOk: true,
    touchedPaths: ["src\\router.ts"]
  });
  assert.equal(windowsResult.action, "protected-deferred");

  const customResult = evaluateOssCandidate(
    {
      name: "custom-protected-helper",
      stars: 100,
      lastCommitDaysAgo: 20,
      license: "MIT",
      dependencyCount: 5,
      auditOk: true,
      touchedPaths: ["src/custom-core.ts"]
    },
    { protectedPaths: ["src/custom-core.ts"], protectedPackageJsonSections: ["bin", "scripts", "prepare"] }
  );
  assert.equal(customResult.action, "protected-deferred");
  assert.match(customResult.reason, /src\/custom-core\.ts/);
});


test("protected package.json scripts impact downgrades to protected deferred", () => {
  const result = evaluateOssCandidate({
    name: "script-runner",
    stars: 100,
    lastCommitDaysAgo: 20,
    license: "BSD-3-Clause",
    dependencyCount: 2,
    auditOk: true,
    touchedPaths: ["package.json"],
    packageJsonSections: ["scripts"]
  });

  assert.deepEqual(result, {
    action: "protected-deferred",
    reason: "candidate touches protected package.json section: scripts"
  });
});

test("candidate rejected when sandbox policy checks fail", () => {
  const result = evaluateOssCandidate({
    name: "stale-heavy-package",
    stars: 50,
    lastCommitDaysAgo: 184,
    license: "GPL-3.0",
    dependencyCount: 20,
    auditOk: false,
    touchedPaths: ["package.json"],
    packageJsonSections: ["dependencies"]
  });

  assert.deepEqual(result, {
    action: "rejected",
    reason: "stars must be greater than 50"
  });
});
