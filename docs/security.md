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
- Return redacted host-facing messages while keeping structured internal audit data.
- Keep raw target paths out of audit records to reduce accidental disclosure.
- Map only a narrow OpenCode-style file-tool surface in this runtime adapter.
- Deny unmappable or unsupported runtime tool calls before policy evaluation.
- Require supported runtime tools to match explicit input shapes; unexpected fields are denied.
- Reject Windows-style absolute syntax and backslash separators in this Linux runtime path layer.
- No wildcard command execution model in the initial evaluator.
- No regex-based path matching in the initial evaluator.
- No environment-variable expansion in config.
- No shell snippets, hooks, or user-defined code.

## Risks Still Open

- JSONC support is intentionally narrow and currently limited to comment stripping before `JSON.parse`.
- Cross-platform behavior should be verified with automated tests before wider use.
- Host integration now preserves the trusted prepared-request boundary, but runtime-specific request mapping still needs verification in a real host.
- Audit consumers still need explicit retention and sink controls outside this library.

## Secure MVP Direction

The next milestone should focus on packaging/release readiness and any last targeted verification gaps without widening the rule surface prematurely.
