import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface OssCandidate {
  name: string;
  stars: number;
  lastCommitDaysAgo: number;
  license: string;
  dependencyCount: number;
  auditOk: boolean;
  touchedPaths: string[];
  packageJsonSections?: string[];
}

export type OssAction =
  | "sandbox-install"
  | "rejected"
  | "protected-deferred"
  | "pending-merge";

export interface OssEvaluation {
  action: OssAction;
  reason: string;
}

export interface OssProtectionPolicy {
  protectedPaths: string[];
  protectedPackageJsonSections: string[];
}

const ALLOWED_LICENSES = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);

const DEFAULT_PROTECTED_PATHS = [
  "src/router.ts",
  "src/ratchet.ts",
  "src/enforcement.ts",
  "src/handoff.ts",
  "src/token-guard.ts",
  ".claude/settings.json"
];

const DEFAULT_PROTECTED_PACKAGE_JSON_SECTIONS = ["bin", "scripts", "prepare"];

export function evaluateOssCandidate(
  candidate: OssCandidate,
  policy: OssProtectionPolicy = {
    protectedPaths: DEFAULT_PROTECTED_PATHS,
    protectedPackageJsonSections: DEFAULT_PROTECTED_PACKAGE_JSON_SECTIONS
  }
): OssEvaluation {
  const protectedPaths = new Set(policy.protectedPaths.map(normalizePath));
  const protectedPackageSections = new Set(policy.protectedPackageJsonSections);
  const protectedPath = candidate.touchedPaths.find((path) => protectedPaths.has(normalizePath(path)));
  if (protectedPath) {
    return {
      action: "protected-deferred",
      reason: `candidate touches protected path: ${normalizePath(protectedPath)}`
    };
  }

  const protectedPackageSection = candidate.packageJsonSections?.find((section) =>
    protectedPackageSections.has(section)
  );
  if (protectedPackageSection) {
    return {
      action: "protected-deferred",
      reason: `candidate touches protected package.json section: ${protectedPackageSection}`
    };
  }

  if (candidate.stars <= 50) {
    return { action: "rejected", reason: "stars must be greater than 50" };
  }

  if (candidate.lastCommitDaysAgo > 183) {
    return { action: "rejected", reason: "last commit must be within 183 days" };
  }

  if (!ALLOWED_LICENSES.has(candidate.license)) {
    return {
      action: "rejected",
      reason: "license must be MIT, Apache-2.0, BSD-2-Clause, or BSD-3-Clause"
    };
  }

  if (candidate.dependencyCount >= 20) {
    return { action: "rejected", reason: "dependency count must be less than 20" };
  }

  if (!candidate.auditOk) {
    return { action: "rejected", reason: "audit must pass" };
  }

  if (isDependencyOnlyPackageChange(candidate)) {
    return {
      action: "sandbox-install",
      reason: "candidate meets sandbox-install criteria with dependency-only package.json changes"
    };
  }

  return {
    action: "pending-merge",
    reason: "candidate requires review before merge because it changes project source files"
  };
}

export async function loadOssProtectionPolicy(root: string): Promise<OssProtectionPolicy> {
  try {
    const raw = await readFile(join(root, ".myorch", "protected-paths.json"), "utf8");
    const parsed = JSON.parse(raw) as { files?: unknown; packageJsonSections?: unknown };
    return {
      protectedPaths: Array.isArray(parsed.files) && parsed.files.every((item) => typeof item === "string")
        ? parsed.files
        : DEFAULT_PROTECTED_PATHS,
      protectedPackageJsonSections:
        Array.isArray(parsed.packageJsonSections) && parsed.packageJsonSections.every((item) => typeof item === "string")
          ? parsed.packageJsonSections
          : DEFAULT_PROTECTED_PACKAGE_JSON_SECTIONS
    };
  } catch {
    return {
      protectedPaths: DEFAULT_PROTECTED_PATHS,
      protectedPackageJsonSections: DEFAULT_PROTECTED_PACKAGE_JSON_SECTIONS
    };
  }
}

function isDependencyOnlyPackageChange(candidate: OssCandidate): boolean {
  const packageSections = candidate.packageJsonSections ?? [];

  return (
    candidate.touchedPaths.length > 0 &&
    candidate.touchedPaths.every((path) => path === "package.json") &&
    packageSections.length > 0 &&
    packageSections.every((section) =>
      section === "dependencies" || section === "optionalDependencies" || section === "peerDependencies"
    )
  );
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}
