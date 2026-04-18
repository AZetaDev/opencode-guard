# opencode-guard

[![Node >=20.11](https://img.shields.io/badge/node-%3E%3D20.11-339933)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

`opencode-guard` is a fail-closed security plugin for OpenCode-style file tools.

It decides whether a file operation should be allowed before the host runtime executes it.

## Why It Exists

`opencode.json` can define what a host/runtime is configured to do.

`opencode-guard` adds a second security layer on top of that runtime configuration:

- `opencode.json` is the host/runtime configuration layer
- `opencode-guard` is the guarded enforcement layer before file-tool execution

That matters because `opencode-guard` is not just an ignore-pattern list.

It does more than hide files from normal workflows:

- it validates the incoming tool request shape
- it loads a strict local policy file
- it canonicalizes the target path against a workspace root
- it rejects unsafe filesystem conditions before policy matching
- it returns a deterministic allow/deny decision with redacted host-facing output

## Why Not Just Ignore Patterns?

Simpler ignore-based approaches are useful when the goal is mainly:

- hiding files from routine workflows
- reducing accidental reads of obvious paths
- applying lightweight path filtering

`opencode-guard` is for a different job.

It acts as an execution gate before a file-tool call runs.

That makes it stronger than a pattern-only approach in a few important ways:

- it validates the incoming request shape instead of trusting raw input
- it canonicalizes paths against a workspace root before matching
- it rejects workspace escape attempts and symlink-based path tricks
- it enforces a fixed fail-closed base even if project policy is weak or incomplete
- it returns structured allow/deny decisions instead of only filtering visibility

Fairly stated, this does not make ignore-based tools obsolete.

Pattern-based tools can still be a good fit for:

- simple hiding or exclusion workflows
- low-friction developer ergonomics
- broad path filtering without execution-time enforcement

`opencode-guard` is the better fit when you want a second enforcement layer for file-tool execution, not just a list of paths to ignore.

## Two Layers

`opencode-guard` is easiest to understand as two stacked layers:

### 1. Fixed Internal Protection Layer

These protections are built into the code and are not user-editable in `.opencode-guard.jsonc`:

- fail-closed behavior when config is missing, invalid, or ambiguous
- strict config schema validation with no unknown properties
- default-deny global posture
- canonical path enforcement against a declared workspace root
- workspace escape rejection
- symlink denial for workspace roots, path segments, and target paths
- malformed runtime envelope rejection
- redacted host-facing decision messages
- Linux-runtime rejection of Windows-style absolute syntax and backslash-separated paths

### 2. User Policy Layer

This is the part users can customize in `.opencode-guard.jsonc`:

- ordered rules
- per-rule `allow` or `deny`
- exact command tokens
- absolute normalized `pathPrefix` values

In other words:

- the guardrails are fixed by the plugin
- the allow/deny policy inside those guardrails is customizable per project

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

In practice, that means the host can be configured one way, while `opencode-guard` still makes a final guarded decision before the file operation proceeds.

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

It should be thought of as a protective execution gate, not just a visibility filter.

It is also intentionally narrower than a full policy engine for every possible tool type. Today it focuses on file-oriented tools where deterministic path enforcement provides the most value.

## How It Works

```text
Host tool call
  -> runtime adapter validates input
  -> fixed internal protections reject malformed or unsafe requests
  -> .opencode-guard.jsonc is loaded and validated
  -> workspace root and target path are canonicalized
  -> unsafe paths are denied fail-closed
  -> user policy rules are checked in order
  -> allow/deny decision is returned
```

## Decision Flow

For a newcomer, the easiest mental model is:

1. The host/runtime sends a file-tool request.
2. `opencode-guard` validates the request envelope before trusting it.
3. `opencode-guard` loads and validates `.opencode-guard.jsonc`.
4. Fixed internal protections normalize and constrain the path.
5. The user-defined rules are checked in order.
6. The plugin returns a structured allow/deny result.

The important split is:

- the host provides the request
- the plugin enforces fixed protections
- `.opencode-guard.jsonc` provides the project-specific policy

## What The Host Sends

At runtime, the plugin needs three core pieces of information:

- the workspace root
- the tool name
- the target file path

OpenCode-style example:

```json
{
  "session": {
    "workspaceRoot": "/workspace/project"
  },
  "tool": {
    "name": "read",
    "input": {
      "filePath": "./README.md"
    }
  }
}
```

Generic host-adapter example:

```json
{
  "command": "read",
  "targetPath": "./README.md",
  "workspaceRoot": "/workspace/project"
}
```

## What The Plugin Validates Internally

Before any user rule is applied, `opencode-guard` enforces its fixed protection base.

That includes:

- request shape validation
- strict config parsing and schema validation
- default-deny posture
- canonical path normalization
- workspace-root containment
- symlink denial
- runtime path syntax checks for the current Linux-oriented model

These checks are not user-editable policy knobs in the current product.

## What `.opencode-guard.jsonc` Customizes

The config file customizes the policy layer inside those fixed guardrails.

Today that means:

- ordered rules
- `allow` and `deny` rule actions
- exact command matching
- one or more absolute normalized path prefixes per rule

The config does not disable the fixed protections above.

## Step-By-Step Example

Imagine the host asks to read `./docs/guide.md` inside `/workspace/project`.

1. The adapter checks that the incoming request shape is valid.
2. The plugin loads `/workspace/project/.opencode-guard.jsonc`.
3. The target path is normalized to an absolute canonical path.
4. If the path escapes the workspace or crosses a denied symlink, the request is denied immediately.
5. If the path is safe, the rules are evaluated from top to bottom.
6. The first matching rule decides the action.
7. If nothing matches, the request is denied by default.

That means the policy file is important, but it is not the only layer making the decision.

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

The host can use the result in a straightforward way:

- `decision.action` tells the host whether to proceed
- `hostMessage` is safe for user-visible output
- `audit` is for structured logging or telemetry

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

In practical terms:

- if `decision.action === "allow"`, the host may continue with the file operation
- if `decision.action === "deny"`, the host should stop and surface `hostMessage`

## Supported OpenCode Tools

The built-in OpenCode adapter currently supports only:

- `read`
- `write`
- `edit`

Anything else is denied before policy evaluation.

That is an intentional scope limit in the current product. The plugin is stronger on a narrow file-tool surface than it would be if it claimed broad execution coverage without equivalent enforcement.

## Configuration

All supported `.opencode-guard.jsonc` options are documented in:

- `docs/configuration.md`
- `examples/.opencode-guard.template.jsonc`

Short version:

- `version` must be `1`
- `defaultAction` must be `"deny"`
- `symlinkPolicy` must be `"deny"`
- `rules` is an ordered array of exact-match rules
- each rule uses either `command` or `commands`
- each rule uses either `pathPrefix` or `pathPrefixes`

The first three settings are effectively part of the fixed protection model today:

- users must include them
- but the current implementation accepts only the hardened values above
- the practical user-controlled layer is the `rules` array

That rule layer is now flexible enough to be written in two styles:

- small explicit rules using `command` + `pathPrefix`
- grouped rules using `commands` + `pathPrefixes`

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
