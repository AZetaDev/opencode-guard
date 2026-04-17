export const CONFIG_FILENAME = ".opencode-guard.jsonc" as const;

export const DEFAULT_ACTION = {
  DENY: "deny",
  ALLOW: "allow",
} as const;

export type GuardAction = (typeof DEFAULT_ACTION)[keyof typeof DEFAULT_ACTION];
