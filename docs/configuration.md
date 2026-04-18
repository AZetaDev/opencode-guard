# Configuration Reference

This document covers every configuration option currently supported by `opencode-guard`.

The runtime configuration filename is fixed:

- `.opencode-guard.jsonc`

The canonical copyable template is:

- `examples/.opencode-guard.template.jsonc`

## Format

- File type: JSONC
- Comments: supported
- Trailing commas: not supported
- Unknown properties: rejected

## Full Schema

```jsonc
{
  "version": 1,
  "defaultAction": "deny",
  "symlinkPolicy": "deny",
  "rules": [
    {
      "id": "allow-readme-read",
      "action": "allow",
      "command": "read",
      "pathPrefix": "/workspace/project/README.md"
    }
  ]
}
```

## Canonical Commented Template

If you want the exact JSONC shape with line-by-line comments, start with:

- `examples/.opencode-guard.template.jsonc`

That file is intended to be copied into a workspace and renamed to `.opencode-guard.jsonc`.

## Top-Level Fields

### `version`

- Type: integer
- Required: yes
- Supported value: `1`

Any other value is rejected.

### `defaultAction`

- Type: string
- Required: yes
- Supported value: `"deny"`

The secure MVP is globally fail-closed. `"allow"` is not supported as the default.

### `symlinkPolicy`

- Type: string
- Required: yes
- Supported value: `"deny"`

The secure MVP denies symlinked workspace roots, symlinked path segments, and symlinked target paths.

### `rules`

- Type: array
- Required: yes
- Order matters: yes

Rules are checked in array order. The first matching rule wins.

## Rule Object

Each rule must contain exactly these fields:

```jsonc
{
  "id": "allow-readme-read",
  "action": "allow",
  "command": "read",
  "pathPrefix": "/workspace/project/README.md"
}
```

### `id`

- Type: string
- Required: yes
- Must be unique across all rules: yes

Used for audit output and debugging.

### `action`

- Type: string
- Required: yes
- Supported values: `"allow"`, `"deny"`

Explicit `deny` rules are supported and can be useful when you want a clear audit reason for a path that would otherwise be denied by the default fallback.

### `command`

- Type: string
- Required: yes
- Format: lowercase token matching `^[a-z0-9:_-]+$`

Examples:

- `read`
- `write`
- `edit`
- `custom-tool`

Important distinction:

- The generic host adapter can evaluate any exact command token.
- The built-in OpenCode adapter currently maps only `read`, `write`, and `edit`.

### `pathPrefix`

- Type: string
- Required: yes
- Must be an absolute path: yes
- Must already be normalized: yes

Rules:

- must start with `/`
- must not end with `/` unless the value is exactly `/`
- must not contain `//`
- must not contain `/./`
- must not contain `/../`

Matching behavior:

- matches the exact path
- also matches children under that path prefix
- does not match sibling paths that merely share the same string prefix

Example:

- Rule prefix: `/workspace/project/docs`
- Matches: `/workspace/project/docs`, `/workspace/project/docs/guide.md`
- Does not match: `/workspace/project/docs-other`

## Validation Rules

The current implementation rejects all of the following:

- missing required fields
- unexpected top-level properties
- unexpected rule properties
- duplicate rule IDs
- non-absolute path prefixes
- non-normalized path prefixes
- empty strings where non-empty strings are required

## Filesystem and Path Behavior

The secure MVP currently assumes a Linux-style runtime path model.

Rejected by path validation:

- Windows-style absolute paths such as `C:/workspace/project/file.txt`
- backslash-separated paths such as `.\\docs\\guide.md`
- null bytes in paths
- paths that escape the workspace root
- symlinked workspace roots
- symlinked path segments
- symlinked target files

## Supported vs Unsupported Today

Supported today:

- strict JSONC parsing with comments
- ordered exact command + path-prefix rules
- explicit `allow` and `deny` rule actions
- fail-closed default deny

Not supported today:

- roles
- groups
- environment variable expansion
- regex matching
- glob matching
- logging config
- shell command policy
- network policy

## Example Configurations

See `examples/` for realistic ready-to-adapt policies:

- `.opencode-guard.template.jsonc`
- `basic-read-only.jsonc`
- `docs-workspace.jsonc`
- `mixed-file-tools.jsonc`
- `explicit-deny-rule.jsonc`
