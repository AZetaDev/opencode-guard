# Architecture

## Goal

Provide a reusable OpenCode security plugin that can make deterministic allow or deny decisions before tool execution.

## First Milestone Boundaries

This block intentionally stops at bootstrap plus a small core model.

- Execution concern: represent an incoming operation as typed data.
- Validation concern: validate config objects before policy evaluation.
- Architecture concern: keep config, core policy, and host integration separated.

## Layers

### `src/config`

Owns config filename, config types, and config validation. It does not perform policy evaluation.

### `src/core`

Owns request types and policy evaluation. It does not read files from disk.

### `src/index.ts`

Exposes the small public surface for future host integration.

## Security Direction

- Default action is deny.
- Rule matching is intentionally narrow.
- Path checks use explicit prefixes and exact command names in this milestone.
- Invalid config never degrades into permissive behavior.

## Deferred To Next Block

- Hardened JSONC parsing for `.opencode-guard.jsonc`
- Canonical path normalization and symlink policy
- OpenCode host integration contract
- Audit logging and test execution in a runtime-enabled environment
