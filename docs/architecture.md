# Architecture

## Goal

Provide a reusable OpenCode security plugin that can make deterministic allow or deny decisions before tool execution.

## Current Boundaries

This block intentionally stops at a small trustworthy host boundary: config loading, request preparation, and policy evaluation chained together through one fail-closed adapter.

- Execution concern: prepare a host request into a canonical internal envelope.
- Validation concern: load and validate `.opencode-guard.jsonc` before evaluation.
- Architecture concern: keep config I/O, path canonicalization, host adaptation, and policy evaluation separated.

## Layers

### `src/config`

Owns config filename, config types, and config validation. It does not perform policy evaluation.

It also owns JSONC loading for `.opencode-guard.jsonc`.

### `src/core`

Owns request types, path canonicalization, request preparation, and policy evaluation.

### `src/index.ts`

Exposes the small public surface for future host integration.

### `src/host`

Owns the host-facing adapter. Raw input is validated here and must pass through config loading and request preparation before evaluation.

## Security Direction

- Default action is deny.
- Rule matching is intentionally narrow.
- Path checks use canonical paths plus explicit prefixes and exact command names.
- Workspace-root escape attempts are rejected before evaluation.
- Symlinks are denied in the initial filesystem policy.
- Host integration failures deny before policy execution can be bypassed.
- Invalid config never degrades into permissive behavior.

## Deferred To Next Block

- Automated tests and runtime verification
- Audit logging with sensitive-data controls
- Broader rule model only if justified by real host requirements
