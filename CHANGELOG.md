# Changelog

## 0.2.0

- validate the plugin against real OpenCode mutation flow rather than config-only assumptions
- guard `write`, `edit`, `patch`, and OpenCode `apply_patch` mutation paths within the current supported model
- tighten the native plugin adapter around the actual runtime lifecycle observed during AERIS adoption testing

## 0.1.2

- add permission-stage support for guarding `patch` operations by path
- add execution-stage guarding for OpenCode `apply_patch` based on extracted patch target paths
- keep patch handling narrow and explicit instead of claiming unsupported payload parsing

## 0.1.1

- rename native plugin option from `enabledTools` to clearer `guardedTools`
- document the runtime-layer comparison between `opencode.json` and `opencode-guard`
- add native-plugin narrowing test coverage and adoption-path documentation

## 0.1.0

- initial strong secure MVP for fail-closed OpenCode-style file tool guarding
- local `.opencode-guard.jsonc` loading with strict validation
- canonical path handling with symlink denial and workspace escape rejection
- redacted host-facing decisions plus structured audit records
- OpenCode runtime adapter for `read`, `write`, and `edit`
- validated TypeScript build, tests, and package dry-run
