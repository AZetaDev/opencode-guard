# Security Model

## Threat Focus

The plugin is meant to reduce accidental or malicious execution of dangerous operations by applying local policy before the host runs a tool.

## Current Decisions

- Fail closed on invalid or missing config data.
- Keep the configuration on global default deny only.
- Load `.opencode-guard.jsonc` locally and reject parse or schema ambiguity.
- Reject unexpected config properties so policy shape stays explicit.
- Deny symlinked workspace roots, symlinked path segments, and symlinked targets.
- Reject target paths that escape the declared workspace root.
- Canonicalize the path before policy evaluation and evaluate only the canonical target.
- Reject malformed raw host input at the integration boundary.
- Deny when config loading or request preparation fails before evaluation.
- No wildcard command execution model in the initial evaluator.
- No regex-based path matching in the initial evaluator.
- No environment-variable expansion in config.
- No shell snippets, hooks, or user-defined code.

## Risks Still Open

- JSONC support is intentionally narrow and currently limited to comment stripping before `JSON.parse`.
- Cross-platform behavior should be verified with automated tests before wider use.
- Host integration now preserves the trusted prepared-request boundary, but runtime-specific request mapping still needs verification in a real host.
- Logging must avoid leaking sensitive file paths or arguments by default.

## Secure MVP Direction

The next milestone should add redacted decision reporting and more host-mapping tests without widening the rule surface prematurely.
