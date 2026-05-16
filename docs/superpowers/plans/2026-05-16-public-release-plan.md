# v1.4.0 Public Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package myorch so a new user can understand, install, verify, and try it in about five minutes without leaking private usage traces.

**Architecture:** Keep source and Claude project files public; keep all generated memory, compact backups, local notes, reports, build output, and dependencies ignored. Documentation is split into short README entrypoints and deeper docs pages. Release goes to a private GitHub repository first; public conversion is a manual user decision.

**Tech Stack:** Node/TypeScript, Claude Code project hooks, Codex CLI, ccusage, PowerShell, Git Bash, GitHub CLI.

---

### Task 1: Sanitize Public Surface

**Files:**
- Modify: `.gitignore`
- Inspect: `.myorch/`, `.claude/`, backup directories, generated outputs

- [ ] Register ignore rules for `.myorch/memory/*.jsonl`, `.myorch/backups/`, `.myorch/handover/`, `.claude/debug/`, `*.backup-*`, `CLAUDE.local.md`, `verification-report.md`, `node_modules/`, `dist/`, `*.log`.
- [ ] Remove or leave ignored generated directories untracked only.
- [ ] Run `git status --ignored`, `git ls-files`, and suspicious-file grep before any push.

### Task 2: Public Documentation

**Files:**
- Create: `README.md`, `README.ko.md`, `docs/INSTALL.md`, `docs/TUTORIAL.md`, `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`, `docs/LIMITS.md`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`

- [ ] Write concise English README with hook, audience, concepts, statusline example, quick start, first `/goal`, docs links, license/contrib/acknowledgments.
- [ ] Write Korean mirror.
- [ ] Write docs pages with install, tutorial, architecture diagram, troubleshooting, and limits.
- [ ] Use MIT license attribution to `pantagram1031` unless GitHub CLI identity check contradicts it.

### Task 3: Fresh Verification

**Files:**
- Use existing `package.json`, `scripts/run-scenarios.mjs`

- [ ] Copy public candidate to a temp directory excluding ignored/generated files.
- [ ] Run README quick start commands: `npm install`, `npm run build`, `npm run verify:all`.
- [ ] Run README example CLI command.
- [ ] Validate markdown links with a local equivalent script if `markdown-link-check` is absent.

### Task 4: Private GitHub Push

**Files:**
- Git metadata only

- [ ] Initialize git if absent.
- [ ] Run final `git ls-files` suspicious grep.
- [ ] Commit `Initial public release (v1.3.5)`.
- [ ] Create private `myorch` repo with requested description and topics.
- [ ] Push to private remote only. Do not make public until user reviews `git ls-files` and says OK.
