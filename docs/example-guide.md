# Example Guide

Use this page to choose the best starting configuration for your workspace.

## Start Here

If you are unsure which file to use first:

1. start with `examples/.opencode-guard.template.jsonc`
2. copy it to your workspace as `.opencode-guard.jsonc`
3. replace the sample absolute paths with real workspace paths
4. remove rules you do not need

## Which Example To Pick

### `.opencode-guard.template.jsonc`

Use this when:

- you want the full commented template
- you are learning the config format
- you want the most complete starting point

### `basic-read-only.jsonc`

Use this when:

- you want the smallest possible working config
- you only need to allow one file read

### `docs-workspace.jsonc`

Use this when:

- you want to allow reads in one content area
- you want an explicit deny rule for a sensitive sub-area

### `mixed-file-tools.jsonc`

Use this when:

- you want a realistic mix of grouped and single-value rules
- you want reads/edits in one area and writes in a narrower area

### `multi-command-group.jsonc`

Use this when:

- you want one rule to cover multiple commands and multiple path areas
- you want a concise policy instead of many repetitive rules

### `explicit-deny-rule.jsonc`

Use this when:

- you want a clear deny reason in audit output
- you want to document a blocked area explicitly instead of relying only on default deny

### `opencode-runtime-envelope.json`

Use this when:

- you want to understand the OpenCode-style runtime input shape
- you want to test how a host should call the plugin

## Rule Of Thumb

- start with the template if you are learning
- start with the smallest example if you already know the exact use case
- use grouped rules when you want less repetition
- use explicit deny rules when the audit reason matters
