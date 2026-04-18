# opencode-guard

[![Node >=20.11](https://img.shields.io/badge/node-%3E%3D20.11-339933)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

`opencode-guard` is a standalone, security-first OpenCode plugin project intended to enforce local policy before risky tool execution.

This repository is intentionally isolated from the live AERIS runtime. It now includes a narrow host adapter that forces raw host input through config loading and canonical request preparation before policy evaluation.

## Highlights

- fail-closed by default
- strict `.opencode-guard.jsonc` validation
- canonical path enforcement with symlink denial
- redacted host-facing decisions plus structured audit output
- narrow OpenCode adapter for `read`, `write`, and `edit`

## Security Principles

- Fail closed when configuration is missing, invalid, or ambiguous.
- Prefer explicit allowlists over broad pattern matching.
- Keep configuration local in `.opencode-guard.jsonc`.
- Separate parsing, validation, and policy evaluation concerns.
- Avoid shell evaluation, dynamic code execution, and implicit trust in tool input.
- Keep the bootstrap milestone globally fail-closed with default deny.

## Install

```bash
npm install opencode-guard
```

Requirements:

- Node `>=20.11.0`
- Local policy file named `.opencode-guard.jsonc`
- A host/runtime that can provide an explicit workspace root and file-tool envelope

For local development in this repository:

```bash
npm install
npm run validate
```

## Current Milestone

- Standalone git repository under `~/workspace/aeris/plugins/opencode-guard/`
- Strict TypeScript project bootstrap
- Real `.opencode-guard.jsonc` loading with JSONC comment stripping
- Strong config validation with exact-key checks and duplicate rule detection
- Canonical path handling rooted to an explicit workspace
- Initial symlink policy with fail-closed denial
- Prepared request envelope for policy evaluation
- Host adapter with fail-closed integration behavior
- Structured audit output with redacted host-facing messages
- OpenCode-style runtime adapter for file-oriented tool calls

## Planned Layout

- `src/config/`: config filename, types, validation
- `src/core/`: request model and policy evaluation
- `src/index.ts`: public entrypoint
- `docs/`: architecture and security model
- `examples/`: sample `.opencode-guard.jsonc`

## OpenCode Adapter

- Root entrypoints: `evaluateOpenCodeToolCall(...)`, `evaluateHostOperation(...)`
- Package subpaths: `opencode-guard/opencode`, `opencode-guard/host`
- Supported OpenCode tools: `read`, `write`, `edit`
- Reference docs: `docs/opencode-adapter.md`
- Example runtime envelope: `examples/opencode-runtime-envelope.json`
- Release checklist: `docs/release-checklist.md`
- Change summary scaffold: `CHANGELOG.md`

## Minimal Use

```ts
import { evaluateOpenCodeToolCall } from "opencode-guard";

const result = await evaluateOpenCodeToolCall({
  configDirectory: "/workspace/project",
  envelope: {
    session: { workspaceRoot: "/workspace/project" },
    tool: { name: "read", input: { filePath: "./README.md" } },
  },
});
```

Use `result.hostMessage` for host-facing responses and `result.audit` for structured internal observability.

This package is intentionally fail-closed and intentionally narrow. It is designed for file-oriented tool guarding, not general shell command policy enforcement.

## Links

- OpenCode adapter guide: `docs/opencode-adapter.md`
- Release checklist: `docs/release-checklist.md`
- Changelog: `CHANGELOG.md`

## Validation

- `npm run typecheck`: strict TypeScript check
- `npm test`: build plus Node-native tests
- `npm run validate`: typecheck plus tests
- `npm run pack:check`: verify publishable package contents

This repo intentionally relies on standard Node 20 tooling for validation. A project-local Node runtime can be used when the host environment does not already provide a working `node` and `npm`.

## Status

This strong secure MVP is release-gated for a narrow file-tool security plugin use case. Remaining work should be environment-specific integration verification rather than broader feature expansion.
