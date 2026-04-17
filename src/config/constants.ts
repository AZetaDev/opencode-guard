export const CONFIG_FILENAME = ".opencode-guard.jsonc" as const;

export const CONFIG_VERSION = 1 as const;

export const DEFAULT_ACTION = {
  DENY: "deny",
  ALLOW: "allow",
} as const;

export type GuardAction = (typeof DEFAULT_ACTION)[keyof typeof DEFAULT_ACTION];

export const SYMLINK_POLICY = {
  DENY: "deny",
} as const;

export type SymlinkPolicy = (typeof SYMLINK_POLICY)[keyof typeof SYMLINK_POLICY];
