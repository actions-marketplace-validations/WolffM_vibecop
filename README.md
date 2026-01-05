# vibeCop

> Cross-repo static analysis + actionable GitHub issue generator for AI agents

vibeCop is a **reusable GitHub Actions workflow** that runs static analysis on any repository and turns findings into **actionable GitHub Issues** designed to be resolved by AI coding agents (like Codex).

## Features

- 🔍 **Multi-tool analysis**: Trunk, ESLint, TypeScript, jscpd, and more
- 📊 **SARIF output**: Results appear in GitHub Code Scanning
- 🤖 **AI-friendly issues**: Structured with suggested fixes and acceptance criteria
- 🔁 **Deduplication**: Stable fingerprints prevent duplicate issues across runs
- ⚙️ **Configurable**: Per-repo overrides via `vibecop.yml`
- 📅 **Cadence-aware**: Schedule heavy tools for weekly/monthly runs only

## Quick Start

### 1. Add the workflow to your repository

Create `.github/workflows/vibecop.yml`:

```yaml
name: vibeCop (Scheduled)

on:
  schedule:
    - cron: '17 3 * * 1'  # Weekly: Mondays 03:17 UTC
  workflow_dispatch: {}

jobs:
  vibeCop:
    uses: <OWNER>/vibeCop/.github/workflows/reusable-analyze.yml@main
    with:
      cadence: 'weekly'
    secrets:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> **Note**: Replace `<OWNER>` with your GitHub organization or username.

### 2. (Optional) Add repo-specific configuration

Create `vibecop.yml` at your repository root:

```yaml
version: 1

issues:
  severity_threshold: "medium"    # low | medium | high | critical
  confidence_threshold: "high"    # low | medium | high
  max_new_per_run: 25

tools:
  jscpd:
    enabled: weekly
    min_tokens: 70
  knip:
    enabled: monthly
```

### 3. Let it run!

On the next scheduled run (or trigger manually), vibeCop will:
1. Detect your repo's language and tooling
2. Run appropriate linters and analyzers
3. Generate SARIF for GitHub Code Scanning
4. Create issues for high-confidence findings

## How It Works

### Analysis Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Repo       │───▶│  Trunk +    │───▶│  Normalize  │───▶│  Create     │
│  Detection  │    │  Tools      │    │  Findings   │    │  Issues     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │                  │
                          ▼                  ▼
                   ┌─────────────┐    ┌─────────────┐
                   │  SARIF      │    │  LLM JSON   │
                   │  (Code Scan)│    │  (Artifacts)│
                   └─────────────┘    └─────────────┘
```

### Issue Lifecycle

1. **Creation**: Issues are created for findings meeting thresholds
2. **Deduplication**: Fingerprints prevent duplicates across runs
3. **Updates**: Existing issues get refreshed with latest evidence
4. **Closure**: (Optional) Issues auto-close after N runs without the finding

### Fingerprinting

Findings are fingerprinted using:
- Tool name
- Rule ID
- File path
- Line number (bucketed to ±20 lines)
- Normalized message

This allows vibeCop to track issues across minor code changes.

## Configuration Reference

### Workflow Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `cadence` | `weekly` | Analysis frequency: `daily`, `weekly`, `monthly` |
| `trunk_arguments` | `check` | Arguments for Trunk |
| `issue_label` | `vibeCop` | Primary label for issues |
| `config_path` | `vibecop.yml` | Path to config file |
| `skip_issues` | `false` | Skip issue creation |

### vibecop.yml Schema

```yaml
version: 1

schedule:
  cadence: weekly           # Caller workflow controls actual schedule
  deep_scan: false          # Enable all tools regardless of cadence

trunk:
  enabled: true
  arguments: "check"

tools:
  tsc:
    enabled: auto           # auto | true | false | daily | weekly | monthly
  eslint:
    enabled: auto
  prettier:
    enabled: auto
  jscpd:
    enabled: weekly
    min_tokens: 70
    threshold: 1
  dependency_cruiser:
    enabled: weekly
  knip:
    enabled: monthly
  semgrep:
    enabled: monthly
    config: "p/default"

issues:
  enabled: true
  label: "vibeCop"
  max_new_per_run: 25
  severity_threshold: "medium"     # Minimum severity
  confidence_threshold: "high"     # Minimum confidence
  close_resolved: false            # Auto-close when finding disappears
  assignees: []

output:
  sarif: true
  llm_json: true
  artifact_retention_days: 14

llm:
  agent_hint: "codex"
  pr_branch_prefix: "vibecop/"
```

## Tool Enablement

Tools can be enabled with:
- `true` / `false`: Always on/off
- `auto`: Run if config file detected (e.g., `eslintrc`, `tsconfig.json`)
- `daily` / `weekly` / `monthly`: Run only on that cadence or slower

| Tool | Default | Detects |
|------|---------|---------|
| Trunk | enabled | Always |
| TypeScript | auto | `tsconfig.json` |
| ESLint | auto | ESLint config files |
| Prettier | auto | Prettier config files |
| jscpd | weekly | Always (on weekly+) |
| dependency-cruiser | weekly | `.dependency-cruiser.js` |
| knip | monthly | `knip.json` |
| semgrep | monthly | Always (on monthly) |

## Severity & Confidence

### Severity Levels

| Level | Description |
|-------|-------------|
| `critical` | Security vulnerabilities, data loss risks |
| `high` | Type errors, circular dependencies, forbidden imports |
| `medium` | Code smells, unused code, complexity |
| `low` | Style issues, minor suggestions |

### Confidence Levels

| Level | Description |
|-------|-------------|
| `high` | Definite issues (type errors, exact duplicates) |
| `medium` | Likely issues, may need context |
| `low` | Suggestions, style preferences |

### Default Thresholds

Issues are created when:
- `severity >= medium` AND `confidence >= high`

Adjust with `issues.severity_threshold` and `issues.confidence_threshold`.

## Issue Format

Issues created by vibeCop include:

- **Summary**: Tool, rule, severity, confidence
- **Location**: File path and line numbers
- **Evidence**: Code snippets when available
- **Suggested Fix**: Goal, steps, acceptance criteria
- **Agent Instructions**: Branch naming, workflow hints
- **Fingerprint**: Hidden marker for deduplication

Example issue body:
```markdown
## Summary

**Tool:** `eslint`
**Rule:** `no-unused-vars`
**Severity:** medium
**Confidence:** high
**Effort:** S

Variable 'x' is declared but never used.

## Location

`src/utils/helper.ts` (line 42)

## Suggested Fix

**Goal:** Remove unused variable declarations

**Steps:**
1. Identify the unused variable from the error message
2. Determine if it should be removed or if it reveals missing functionality
3. Remove the variable declaration if unused

**Acceptance Criteria:**
- [ ] No unused variable warnings in affected file
- [ ] Tests continue to pass
```

## Output Artifacts

Each run produces:

| File | Description |
|------|-------------|
| `results.sarif` | SARIF 2.1.0 for GitHub Code Scanning |
| `results.llm.json` | Structured findings for AI agents |
| `findings.json` | Raw findings array |
| `context.json` | Run context and repo profile |

### LLM JSON Schema

```json
{
  "version": 1,
  "repo": { "owner": "...", "name": "...", "commit": "..." },
  "summary": {
    "totalFindings": 42,
    "highConfidence": 10,
    "actionable": 8
  },
  "findings": [
    {
      "fingerprint": "sha256:...",
      "tool": "eslint",
      "ruleId": "no-unused-vars",
      "severity": "medium",
      "confidence": "high",
      "effort": "S",
      "locations": [{ "path": "...", "startLine": 42 }],
      "suggestedFix": {
        "goal": "...",
        "steps": ["..."],
        "acceptance": ["..."]
      }
    }
  ]
}
```

## AI Agent Integration

### Issue-Driven Workflow

1. Agent picks highest-priority issue (severity × confidence × effort)
2. Creates branch: `vibecop/<fingerprint>/<rule-slug>`
3. Implements suggested fix
4. Runs `trunk check` and tests
5. Opens PR: "Fixes #123"

### Using LLM JSON

Download the artifact and process programmatically:

```typescript
const results = await fetchArtifact('vibecop-results');
const llmJson = JSON.parse(results['results.llm.json']);

// Pick actionable findings sorted by priority
const actionable = llmJson.findings
  .filter(f => f.confidence === 'high')
  .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

// Work through issues
for (const finding of actionable) {
  await agent.fix(finding);
}
```

## FAQ

### SARIF upload permission errors

Ensure your workflow has `security-events: write` permission:

```yaml
permissions:
  contents: read
  security-events: write
  issues: write
```

### Too many issues created

Reduce noise by:
1. Increasing `severity_threshold` to `high`
2. Reducing `max_new_per_run`
3. Disabling noisy tools

### How to suppress a finding

Options:
1. Fix the issue (recommended)
2. Add inline suppression comment (tool-specific)
3. Configure tool to ignore the rule
4. Add path to tool's ignore list

### Monorepo behavior

vibeCop detects monorepos via:
- `pnpm-workspace.yaml`
- `package.json` workspaces
- `turbo.json` / `nx.json` / `lerna.json`

Analysis runs at the repo root and covers all packages.

### Rate limiting

vibeCop respects GitHub API limits:
- Issues are capped at `max_new_per_run` per execution
- API calls include small delays
- Use `GITHUB_TOKEN` (not PAT) for repo-scoped limits

## Development

### Local Setup

```bash
# Clone the repo
git clone https://github.com/<OWNER>/vibeCop.git
cd vibeCop

# Install dependencies
pnpm install

# Run tests
pnpm test

# Type check
pnpm typecheck
```

### Running Locally

```bash
# Analyze a target repo
npx tsx scripts/analyze.ts --root /path/to/repo --cadence weekly --skip-issues
```

### Scripts

| Script | Description |
|--------|-------------|
| `analyze.ts` | Main orchestrator |
| `repo-detect.ts` | Detect repo profile |
| `build-sarif.ts` | Generate SARIF output |
| `build-llm-json.ts` | Generate LLM JSON output |
| `sarif-to-issues.ts` | Create/update GitHub issues |

## License

MIT
