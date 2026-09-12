# BugReplay

> **"Logs tell you what happened. BugReplay tells you how to reproduce it."**

BugReplay is an AI-assisted debugging CLI that ingests application logs and source-code context, identifies and groups incidents, reconstructs the likely failure chain, determines the root cause with evidence, generates a reproducible test case, and verifies code fixes against real test executions.

---

## The Verifiable Debugging Workflow

```
LOGS
  ↓
INCIDENT DETECTION
  ↓
ERROR GROUPING
  ↓
EVIDENCE COLLECTION
  ↓
ROOT-CAUSE ANALYSIS
  ↓
REPRODUCTION PLAN
  ↓
GENERATED TEST
  ↓
ACTUAL TEST EXECUTION (Reproduced: 🔴)
  ↓
OPTIONAL PATCH
  ↓
REGRESSION VERIFICATION (Resolved: ✓)
```

**Key Principle:** AI proposes hypotheses. The system gathers evidence. The test runner verifies claims.

---

## Quick Start Demo (< 3 minutes)

BugReplay includes a complete, realistic demo project containing application logs and intentional bugs (such as payment API contract mismatches).

### 1. Install & Link CLI

```bash
# Clone and enter the repository
cd c:\BugReplay

# Install dependencies and build
npm install
npm run build

# Link bug-replay globally
npm link
```

### 2. Run the Demo

```bash
cd demo

# 1. Scan the server logs
bug-replay scan logs/server.log

# 2. View grouped incidents
bug-replay incidents

# 3. Analyze Incident #1 (Root-cause analysis)
bug-replay analyze 1

# 4. Generate reproduction test
bug-replay reproduce 1

# 5. Verify the bug is reproduced (runs test — must fail on buggy code)
bug-replay verify 1

# 6. Propose and apply patch (shows diff and requests y/N)
bug-replay fix 1

# 7. Verify regression test passes on patched code
bug-replay verify 1

# 8. Generate incident report
bug-replay report 1
```

---

## CLI Commands

| Command | Description |
|---|---|
| `bug-replay scan <logfile>` | Parses log file, groups errors, and saves incident state |
| `bug-replay incidents` | Lists all detected incidents with occurrence count, status, and locations |
| `bug-replay analyze <id>` | Gathers source code, git history, and performs root-cause analysis |
| `bug-replay reproduce <id>` | Generates a reproduction plan and writes a vitest regression test |
| `bug-replay fix <id>` | Generates a minimal diff patch and applies it after explicit confirmation |
| `bug-replay verify <id>` | Executes the generated test with vitest to verify claims |
| `bug-replay report <id>` | Exports a markdown postmortem report |
| `bug-replay config` | Displays active provider, model, and configuration |

---

## Architecture & Design

```
src/
├── cli/
│   ├── index.ts               # Commander CLI entrypoint
│   ├── commands/              # scan, incidents, analyze, reproduce, fix, verify, report, config
│   └── ui/                    # Terminal formatting, banners, diffs, confidence meter
│
├── core/
│   ├── parser/                # Multi-format log parser & stack trace extractor
│   ├── incidents/             # Normalization and deterministic error grouping
│   ├── evidence/              # Source code context & git correlation engine
│   ├── reproduction/          # Regression test generation
│   └── patching/              # Safe diff application & backup creation
│
├── ai/
│   ├── provider.ts            # AIProvider interface & factory
│   ├── providers/             # GeminiProvider (REST-based, zero extra SDKs)
│   ├── schemas/               # Zod validation schemas for all LLM responses
│   └── prompts/               # Versioned prompt templates (analyze, reproduce, patch)
│
├── integrations/
│   ├── filesystem.ts          # Safe source extraction with path traversal protection
│   ├── git.ts                 # Read-only git blame, log, and diff inspector
│   └── test-runner.ts         # Allowlisted test execution runner
│
├── security/
│   ├── redaction.ts           # Secret/credential redaction (API keys, JWT, passwords)
│   └── command-policy.ts      # Strict command execution allowlist
│
└── storage/
    └── store.ts               # Project-local state persistence (.bugreplay/)
```

---

## Security Model

1. **Strict Command Allowlist**: Only `npx vitest run ...` and `npm test` can be executed automatically. Destructive commands (`rm`, `format`, `eval`, `git push --force`) are blocked.
2. **Secret Redaction**: All source code, logs, and stack traces are filtered through regex redactors to scrub API keys, passwords, JWT tokens, and private keys prior to sending to LLMs.
3. **No Automatic Code Mutation**: Patches require explicit user confirmation (`[y/N]`) and automatically produce `.bugreplay.orig` backups for instant recovery.
4. **Local State Only**: All incident records are saved project-locally inside `.bugreplay/state.json`.

---

## Running the Automated Test Suite

```bash
# Run all 54 unit & end-to-end tests
npm test

# Run type checks
npm run lint
```

