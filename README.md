# opencode-guard

[![Node >=20.11](https://img.shields.io/badge/node-%3E%3D20.11-339933)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

`opencode-guard` is a fail-closed security plugin for OpenCode-style file tools.

It decides whether a file operation should be allowed before the host runtime executes it.

## Start Here

If you are new to the project, read the docs in this order:

1. `README.md` for what the plugin does and how it is used
2. `docs/configuration.md` for the exact `.opencode-guard.jsonc` structure
3. `examples/.opencode-guard.template.jsonc` for a complete commented template you can copy
4. `examples/` for smaller policy examples

## What It Is

`opencode-guard` is a small policy engine for local file-tool execution.

It is designed for hosts that can provide:

- a workspace root
- a tool name such as `read`, `write`, or `edit`
- a file path for the requested operation

The plugin loads a local `.opencode-guard.jsonc` file, validates it strictly, normalizes the target path, rejects unsafe path conditions, and returns an allow/deny decision.

## What It Protects

- accidental access outside the declared workspace
- symlink-based path tricks inside the checked path segments
- malformed or unsupported runtime envelopes
- file-tool calls that are not explicitly allowed by policy
- ambiguous or invalid configuration

## What It Does Not Protect

- arbitrary shell command execution policies
- network access or external service calls
- secret management or data loss prevention beyond file-path policy
- host runtimes that bypass the plugin and execute tools directly
- platform-specific behavior that has not been verified in the target environment

This package is intentionally narrow. It is a strong secure MVP for file-oriented tool guarding, not a complete security platform.

## How It Works

```text
Host tool call
  -> runtime adapter validates input
  -> .opencode-guard.jsonc is loaded and validated
  -> workspace root and target path are canonicalized
  -> unsafe paths are denied fail-closed
  -> rules are checked in order
  -> allow/deny decision is returned
```

## Install

```bash
npm install opencode-guard
```

Requirements:

- Node `>=20.11.0`
- a local policy file named `.opencode-guard.jsonc`
- a host/runtime that can provide an explicit workspace root and file-tool envelope

For local development in this repository:

```bash
npm install
npm run validate
```

## Package Entry Points

| Entry point | Use for |
| --- | --- |
| `opencode-guard` | simple imports from the main package |
| `opencode-guard/opencode` | OpenCode-style runtime envelopes |
| `opencode-guard/host` | generic host integration |

## Quick Start

Create a local `.opencode-guard.jsonc` file.

The easiest starting point is:

- copy `examples/.opencode-guard.template.jsonc`
- rename it to `.opencode-guard.jsonc`
- replace the sample absolute paths with paths from your own workspace

Minimal example:

```jsonc
{
  "version": 1,
  "defaultAction": "deny",
  "symlinkPolicy": "deny",
  "rules": [
    {
      "id": "allow-readme-read",
      "action": "allow",
      "command": "read",
      "pathPrefix": "/workspace/project/README.md"
    }
  ]
}
```

Evaluate an OpenCode-style tool call:

```ts
import { evaluateOpenCodeToolCall } from "opencode-guard";

const result = await evaluateOpenCodeToolCall({
  configDirectory: "/workspace/project",
  envelope: {
    session: { workspaceRoot: "/workspace/project" },
    tool: {
      name: "read",
      input: { filePath: "./README.md" },
    },
  },
});

if (result.decision.action === "deny") {
  console.log(result.hostMessage);
}
```

Example result shape:

```ts
{
  runtime: "opencode",
  mappedToolName: "read",
  decision: {
    action: "allow",
    reason: "Matched rule 'allow-readme-read'.",
    matchedRuleId: "allow-readme-read"
  },
  hostMessage: "Operation allowed by local security policy.",
  reasonCode: "allow_rule_match",
  failureStage: "none",
  audit: {
    action: "allow",
    failureStage: "none",
    reasonCode: "allow_rule_match",
    matchedRuleId: "allow-readme-read",
    configLoaded: true,
    configPath: "/workspace/project/.opencode-guard.jsonc",
    command: "read",
    targetPathKind: "relative",
    targetPathExists: true
  }
}
```

Use `hostMessage` for user-visible responses and `audit` for structured internal logging or telemetry.

## Supported OpenCode Tools

The built-in OpenCode adapter currently supports only:

- `read`
- `write`
- `edit`

Anything else is denied before policy evaluation.

## Configuration

All supported `.opencode-guard.jsonc` options are documented in:

- `docs/configuration.md`
- `examples/.opencode-guard.template.jsonc`

Short version:

- `version` must be `1`
- `defaultAction` must be `"deny"`
- `symlinkPolicy` must be `"deny"`
- `rules` is an ordered array of exact-match rules

Important limits:

- comments are allowed because the file is JSONC
- trailing commas are not supported
- unexpected properties are rejected
- duplicate rule IDs are rejected
- path prefixes must already be normalized absolute paths

## Real Example Policies

The `examples/` directory contains copy-ready examples:

- `examples/.opencode-guard.template.jsonc`
- `examples/basic-read-only.jsonc`
- `examples/docs-workspace.jsonc`
- `examples/mixed-file-tools.jsonc`
- `examples/explicit-deny-rule.jsonc`
- `examples/opencode-runtime-envelope.json`

Copy one of the `.jsonc` examples to your workspace as `.opencode-guard.jsonc` and then adjust the absolute paths for your environment.

## Documentation Map

- OpenCode adapter guide: `docs/opencode-adapter.md`
- Full config reference: `docs/configuration.md`
- Security model: `docs/security.md`
- Architecture notes: `docs/architecture.md`
- Release checklist: `docs/release-checklist.md`
- Changelog: `CHANGELOG.md`

## Validation

- `npm run typecheck`
- `npm test`
- `npm run validate`
- `npm run pack:check`

This repository uses standard Node 20 tooling for verification.

## Repo Structure

- `src/` contains the implementation
- `test/` contains runtime tests
- `docs/` contains public documentation and security notes
- `examples/` contains copyable sample config and envelope files

That layout is appropriate for a public reusable plugin repository.
