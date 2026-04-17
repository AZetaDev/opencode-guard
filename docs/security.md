# Security Model

## Threat Focus

The plugin is meant to reduce accidental or malicious execution of dangerous operations by applying local policy before the host runs a tool.

## First-Block Decisions

- Fail closed on invalid or missing config data.
- Keep the bootstrap configuration on global default deny only.
- No wildcard command execution model in the initial evaluator.
- No regex-based path matching in the initial evaluator.
- No environment-variable expansion in config.
- No shell snippets, hooks, or user-defined code.

## Risks Still Open

- JSONC parser selection and parsing hardening are not implemented yet.
- Path normalization must handle symlinks, relative traversal, and platform differences.
- Host integration must define a trustworthy request envelope so policy decisions cannot be bypassed by malformed metadata.
- Logging must avoid leaking sensitive file paths or arguments by default.

## Secure MVP Direction

The next milestone should keep the surface small: load config, normalize target paths, evaluate a request, and return a structured decision with a non-sensitive reason.
