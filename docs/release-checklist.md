# Release Checklist

## Before Tagging

- confirm working tree is clean
- run `npm run validate`
- run `npm run pack:check`
- verify `README.md` matches the intended public API and supported tool coverage
- verify `CHANGELOG.md` contains release notes for the version being published
- verify `.opencode-guard.jsonc` remains the documented config filename

## Public API Gate

- root package should expose only runtime-facing entrypoints and shared decision constants
- `opencode-guard/host` should expose host adapter entrypoints and result types only
- `opencode-guard/opencode` should expose OpenCode adapter entrypoints and supported runtime input types only
- internal config/core implementation modules should not be relied on as public API

## Security Gate

- confirm fail-closed deny remains the default posture
- confirm unsupported or malformed runtime tool calls deny before policy evaluation
- confirm host-facing messages remain redacted
- confirm audit records do not include raw target paths
- confirm Linux runtime path checks still reject Windows-style syntax and backslash separators

## Publish Note

This package is a strong secure MVP, not a complete security product. Host integration, deployment policy, audit sink retention, and cross-platform verification still require environment-specific review.
