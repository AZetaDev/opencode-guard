# opencode-guard

`opencode-guard` is a standalone, security-first OpenCode plugin project intended to enforce local policy before risky tool execution.

This repository is intentionally isolated from the live AERIS runtime. It now includes a narrow Block 2 implementation for config loading, request preparation, and fail-closed path handling.

## Security Principles

- Fail closed when configuration is missing, invalid, or ambiguous.
- Prefer explicit allowlists over broad pattern matching.
- Keep configuration local in `.opencode-guard.jsonc`.
- Separate parsing, validation, and policy evaluation concerns.
- Avoid shell evaluation, dynamic code execution, and implicit trust in tool input.
- Keep the bootstrap milestone globally fail-closed with default deny.

## Current Milestone

- Standalone git repository under `~/workspace/aeris/plugins/opencode-guard/`
- Strict TypeScript project bootstrap
- Real `.opencode-guard.jsonc` loading with JSONC comment stripping
- Strong config validation with exact-key checks and duplicate rule detection
- Canonical path handling rooted to an explicit workspace
- Initial symlink policy with fail-closed denial
- Prepared request envelope for policy evaluation

## Planned Layout

- `src/config/`: config filename, types, validation
- `src/core/`: request model and policy evaluation
- `src/index.ts`: public entrypoint
- `docs/`: architecture and security model
- `examples/`: sample `.opencode-guard.jsonc`

## Validation

- `npm run typecheck`: strict TypeScript check
- `npm test`: build plus Node-native tests
- `npm run validate`: typecheck plus tests

This repo intentionally relies on standard Node 20 tooling for validation. A project-local Node runtime can be used when the host environment does not already provide a working `node` and `npm`.

## Status

This is still not integrated into OpenCode or AERIS. The next block should add tests, decision/audit reporting, and the host integration adapter.
