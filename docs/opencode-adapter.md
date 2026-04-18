# OpenCode Adapter

## Goal

Provide a small, fail-closed adapter from an OpenCode-style runtime envelope into the guarded host evaluation path.

## Package Entry Points

- Root import: `opencode-guard`
- OpenCode-specific import: `opencode-guard/opencode`
- Generic host adapter import: `opencode-guard/host`

## Supported Tool Coverage

Only these file-oriented tools are mapped:

- `read`
- `write`
- `edit`

Everything else is denied before policy evaluation.

## Required Envelope Shape

```json
{
  "session": {
    "workspaceRoot": "/absolute/workspace"
  },
  "tool": {
    "name": "read",
    "input": {
      "filePath": "./docs/guide.md"
    }
  }
}
```

## Tool Input Shapes

### `read`

Allowed keys:

- `filePath` required string
- `offset` optional positive integer
- `limit` optional positive integer

### `write`

Allowed keys:

- `filePath` required string
- `content` required string

### `edit`

Allowed keys:

- `filePath` required string
- `oldString` required string
- `newString` required string
- `replaceAll` optional boolean

Unexpected keys or wrong value types cause a fail-closed deny before policy evaluation.

## Security Notes

- The adapter only extracts `filePath` for policy matching.
- Content and edit payloads are not interpreted as policy input in this block.
- Windows-style absolute syntax and backslash-separated paths are rejected in this Linux runtime.
- Raw runtime input still flows through config loading and canonical request preparation before evaluation.

## Example

See `examples/opencode-runtime-envelope.json` for a minimal `read` call example.
