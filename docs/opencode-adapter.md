# OpenCode Adapter

## Goal

Provide a small, fail-closed adapter from an OpenCode-style runtime envelope into the guarded host evaluation path.

## Mental Model

The OpenCode adapter is only the entrypoint.

Its job is to:

1. accept an OpenCode-style runtime envelope
2. validate that the envelope matches a supported file-tool shape
3. map that envelope into the generic guarded host request
4. pass the mapped request into the core enforcement flow

It does not bypass the core guard. It feeds into it.

## Package Entry Points

- Root import: `opencode-guard`
- OpenCode-specific import: `opencode-guard/opencode`
- Generic host adapter import: `opencode-guard/host`
- Native plugin module import: `opencode-guard/plugin`

## Native Plugin Adapter

The repository now includes a native OpenCode plugin adapter.

It is intentionally narrow:

- hooks used:
  - `permission.ask`
  - `tool.execute.before`
- enforced tools: `read`, `write`, `edit`
- non-target tools: ignored by the plugin
- narrowing option: `guardedTools`

This keeps the integration aligned with the current secure MVP instead of pretending to cover the full runtime surface.

## Supported Tool Coverage

Only these file-oriented tools are mapped:

- `read`
- `write`
- `edit`

Everything else is denied before policy evaluation.

That means unsupported tools do not fall through to a weaker code path. They are denied immediately.

For guarded file tools, the adapter also evaluates permission requests before user confirmation can authorize a path that falls outside policy.

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

## End-To-End Flow

```text
OpenCode envelope
  -> adapter evaluates guarded permission requests when applicable
  -> adapter validates supported tool shape
  -> adapter maps to generic host request
  -> config is loaded from configDirectory
  -> path is canonicalized and checked
  -> user policy rules are evaluated
  -> host receives structured decision result
```

## Example

See `examples/opencode-runtime-envelope.json` for a minimal `read` call example.

For the matching policy file format, see `docs/configuration.md`.

Minimal plugin registration shape:

```jsonc
{
  "plugin": [
    [
      "/absolute/path/to/opencode-guard/dist/plugin/index.js",
      {
        "guardedTools": ["write", "edit"]
      }
    ]
  ]
}
```

## What The Host Gets Back

The adapter returns a structured result that includes:

- `decision.action`: `allow` or `deny`
- `decision.reason`: internal decision explanation
- `hostMessage`: redacted host-facing text
- `reasonCode`: structured reason category
- `failureStage`: where evaluation failed or completed
- `audit`: structured audit-safe metadata

That lets the host separate user-facing communication from internal observability.
