# opencode-guard

`opencode-guard` is a standalone, security-first OpenCode plugin project intended to enforce local policy before risky tool execution.

This repository is intentionally isolated from the live AERIS runtime. The first milestone only establishes the bootstrap, architecture boundaries, and a narrow fail-closed core.

## Security Principles

- Fail closed when configuration is missing, invalid, or ambiguous.
- Prefer explicit allowlists over broad pattern matching.
- Keep configuration local in `.opencode-guard.jsonc`.
- Separate parsing, validation, and policy evaluation concerns.
- Avoid shell evaluation, dynamic code execution, and implicit trust in tool input.
- Keep the bootstrap milestone globally fail-closed with default deny.

## First Milestone

- Standalone git repository under `~/workspace/aeris/plugins/opencode-guard/`
- Strict TypeScript project bootstrap
- Initial config contract for `.opencode-guard.jsonc`
- Narrow rule validator and deterministic policy evaluator
- Security and architecture docs for later hardening work

## Planned Layout

- `src/config/`: config filename, types, validation
- `src/core/`: request model and policy evaluation
- `src/index.ts`: public entrypoint
- `docs/`: architecture and security model
- `examples/`: sample `.opencode-guard.jsonc`

## Status

This is not yet integrated into OpenCode or AERIS. The next block should add a hardened JSONC loader, canonical path handling, and real integration boundaries for the host plugin API.
