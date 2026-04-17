# Architecture

## Goal

Provide a reusable OpenCode security plugin that can make deterministic allow or deny decisions before tool execution.

## Block 2 Boundaries

This block intentionally stops at config loading, request preparation, and a small trustworthy policy core.

- Execution concern: prepare a host request into a canonical internal envelope.
- Validation concern: load and validate `.opencode-guard.jsonc` before evaluation.
- Architecture concern: keep config I/O, path canonicalization, and policy evaluation separated.

## Layers

### `src/config`

Owns config filename, config types, and config validation. It does not perform policy evaluation.

It also owns JSONC loading for `.opencode-guard.jsonc`.

### `src/core`

Owns request types, path canonicalization, request preparation, and policy evaluation.

### `src/index.ts`

Exposes the small public surface for future host integration.

## Security Direction

- Default action is deny.
- Rule matching is intentionally narrow.
- Path checks use canonical paths plus explicit prefixes and exact command names.
- Workspace-root escape attempts are rejected before evaluation.
- Symlinks are denied in the initial filesystem policy.
- Invalid config never degrades into permissive behavior.

## Deferred To Next Block

- Automated tests and runtime verification
- OpenCode host integration adapter
- Audit logging with sensitive-data controls
- Broader rule model only if justified by real host requirements
