# Security Model

## Threat Focus

The plugin is meant to reduce accidental or malicious execution of dangerous operations by applying local policy before the host runs a tool.

## Current Decisions

- Treat the plugin as a second enforcement layer above host/runtime configuration.
- Keep core protections fixed in code instead of making them user-editable policy knobs.
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

## Fixed Protection Base vs User Policy

### Fixed Protection Base

The following are internal protections implemented by the plugin itself:

- input envelope validation
- strict config shape validation
- default deny requirement
- symlink denial
- canonical path enforcement
- workspace-root containment
- redacted host-facing messages

### User Policy Layer

Users currently control only the ordered rule set inside `.opencode-guard.jsonc`.

That means users can choose:

- which commands are allowed or denied
- which absolute normalized paths those rules apply to
- the order of precedence between rules
- whether a rule uses single-value or grouped matching for commands and paths

They cannot use configuration to disable the core fail-closed protections above.

## Compared With Pattern-Only Filtering

This plugin should not be read as "just another ignore file."

Pattern-only filtering and ignore-based approaches are often good at reducing noise or hiding paths from normal workflows. `opencode-guard` adds value in a different place: execution-time enforcement.

That means the plugin:

- validates input structure before evaluation
- normalizes and contains paths before matching them
- denies unsupported or malformed runtime tool calls
- keeps a fixed internal protection base that project config cannot switch off

Its scope is narrower on purpose:

- file-oriented tool execution is in scope
- broad shell-policy governance is out of scope

That tradeoff is intentional. The project aims to be strong and predictable on a constrained surface rather than broad and weak.

## Risks Still Open

- JSONC support is intentionally narrow and currently limited to comment stripping before `JSON.parse`.
- Cross-platform behavior should be verified with automated tests before wider use.
- Host integration now preserves the trusted prepared-request boundary, but runtime-specific request mapping still needs verification in a real host.
- Audit consumers still need explicit retention and sink controls outside this library.

## Secure MVP Direction

The next milestone should focus on packaging/release readiness and any last targeted verification gaps without widening the rule surface prematurely.
