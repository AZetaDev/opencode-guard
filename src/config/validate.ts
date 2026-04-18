import { CONFIG_VERSION, DEFAULT_ACTION, SYMLINK_POLICY } from "./constants.js";
import type { GuardConfig, GuardRule, ValidationIssue, ValidationResult } from "./types.js";

const TOP_LEVEL_KEYS = {
  VERSION: "version",
  DEFAULT_ACTION: "defaultAction",
  SYMLINK_POLICY: "symlinkPolicy",
  RULES: "rules",
} as const;

const RULE_KEYS = {
  ID: "id",
  ACTION: "action",
  COMMAND: "command",
  COMMANDS: "commands",
  PATH_PREFIX: "pathPrefix",
  PATH_PREFIXES: "pathPrefixes",
} as const;

const COMMAND_PATTERN = /^[a-z0-9:_-]+$/;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGuardAction(value: unknown): value is GuardRule["action"] {
  return value === DEFAULT_ACTION.ALLOW || value === DEFAULT_ACTION.DENY;
}

function isExactKeySet(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  path: string,
  issues: ValidationIssue[],
): boolean {
  const actualKeys = Object.keys(value);
  const expectedKeySet = new Set(expectedKeys);
  let ok = true;

  for (const key of actualKeys) {
    if (!expectedKeySet.has(key)) {
      issues.push({ path: `${path}.${key}`, message: "Unexpected property." });
      ok = false;
    }
  }

  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      issues.push({ path: `${path}.${key}`, message: "Missing required property." });
      ok = false;
    }
  }

  return ok;
}

function readNonEmptyString(value: unknown, path: string, issues: ValidationIssue[]): string | null {
  if (typeof value !== "string") {
    issues.push({ path, message: "Expected a string." });
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    issues.push({ path, message: "Expected a non-empty string." });
    return null;
  }

  return normalizedValue;
}

function readNonEmptyStringArray(value: unknown, path: string, issues: ValidationIssue[]): string[] | null {
  if (!Array.isArray(value)) {
    issues.push({ path, message: "Expected an array of strings." });
    return null;
  }

  if (value.length === 0) {
    issues.push({ path, message: "Expected a non-empty array." });
    return null;
  }

  const normalizedValues = value
    .map((entry, index) => readNonEmptyString(entry, `${path}[${index}]`, issues))
    .filter((entry): entry is string => entry !== null);

  if (normalizedValues.length !== value.length) {
    return null;
  }

  return normalizedValues;
}

function validateCommandToken(command: string, path: string, issues: ValidationIssue[]): void {
  if (!COMMAND_PATTERN.test(command)) {
    issues.push({ path, message: "Expected a lowercase command token." });
  }
}

function validatePathPrefixValue(pathPrefix: string, path: string, issues: ValidationIssue[]): boolean {
  if (!pathPrefix.startsWith("/")) {
    issues.push({ path, message: "Expected an absolute path prefix." });
    return false;
  }

  if (pathPrefix !== "/" && pathPrefix.endsWith("/")) {
    issues.push({ path, message: "Trailing slash is not allowed." });
    return false;
  }

  if (pathPrefix.includes("//") || pathPrefix.includes("/./") || pathPrefix.includes("/../") || pathPrefix.endsWith("/.") || pathPrefix.endsWith("/..")) {
    issues.push({ path, message: "Path prefix must already be normalized." });
    return false;
  }

  return true;
}

function isValidRuleShape(value: Record<string, unknown>): boolean {
  const actualKeys = Object.keys(value).sort();
  const validShapes = [
    [RULE_KEYS.ACTION, RULE_KEYS.COMMAND, RULE_KEYS.ID, RULE_KEYS.PATH_PREFIX],
    [RULE_KEYS.ACTION, RULE_KEYS.COMMAND, RULE_KEYS.ID, RULE_KEYS.PATH_PREFIXES],
    [RULE_KEYS.ACTION, RULE_KEYS.COMMANDS, RULE_KEYS.ID, RULE_KEYS.PATH_PREFIX],
    [RULE_KEYS.ACTION, RULE_KEYS.COMMANDS, RULE_KEYS.ID, RULE_KEYS.PATH_PREFIXES],
  ].map((shape) => shape.slice().sort().join("|"));

  return validShapes.includes(actualKeys.join("|"));
}

function validateRule(value: unknown, index: number, issues: ValidationIssue[]): GuardRule | null {
  const pathBase = `rules[${index}]`;

  if (!isObjectRecord(value)) {
    issues.push({ path: pathBase, message: "Expected an object rule." });
    return null;
  }

  if (!isValidRuleShape(value)) {
    issues.push({ path: pathBase, message: "Expected exactly one command field and one path field." });
  }

  const id = readNonEmptyString(value.id, `${pathBase}.id`, issues);
  const command = Object.prototype.hasOwnProperty.call(value, RULE_KEYS.COMMAND)
    ? readNonEmptyString(value.command, `${pathBase}.command`, issues)
    : null;
  const commands = Object.prototype.hasOwnProperty.call(value, RULE_KEYS.COMMANDS)
    ? readNonEmptyStringArray(value.commands, `${pathBase}.commands`, issues)
    : null;
  const pathPrefix = Object.prototype.hasOwnProperty.call(value, RULE_KEYS.PATH_PREFIX)
    ? readNonEmptyString(value.pathPrefix, `${pathBase}.pathPrefix`, issues)
    : null;
  const pathPrefixes = Object.prototype.hasOwnProperty.call(value, RULE_KEYS.PATH_PREFIXES)
    ? readNonEmptyStringArray(value.pathPrefixes, `${pathBase}.pathPrefixes`, issues)
    : null;

  if (!isGuardAction(value.action)) {
    issues.push({ path: `${pathBase}.action`, message: "Expected 'allow' or 'deny'." });
  }

  const normalizedCommands = command !== null ? [command] : commands;
  const normalizedPathPrefixes = pathPrefix !== null ? [pathPrefix] : pathPrefixes;

  if (
    !isValidRuleShape(value) ||
    id === null ||
    normalizedCommands === null ||
    normalizedPathPrefixes === null ||
    !isGuardAction(value.action)
  ) {
    return null;
  }

  for (const [index, normalizedCommand] of normalizedCommands.entries()) {
    validateCommandToken(normalizedCommand, command !== null ? `${pathBase}.command` : `${pathBase}.commands[${index}]`, issues);
  }

  const areAllPathPrefixesValid = normalizedPathPrefixes.every((normalizedPathPrefix, index) => {
    return validatePathPrefixValue(
      normalizedPathPrefix,
      pathPrefix !== null ? `${pathBase}.pathPrefix` : `${pathBase}.pathPrefixes[${index}]`,
      issues,
    );
  });

  if (!areAllPathPrefixesValid) {
    return null;
  }

  return {
    id,
    action: value.action,
    commands: normalizedCommands,
    pathPrefixes: normalizedPathPrefixes,
  };
}

export function validateGuardConfig(value: unknown): ValidationResult & { config?: GuardConfig } {
  const issues: ValidationIssue[] = [];

  if (!isObjectRecord(value)) {
    return {
      ok: false,
      issues: [{ path: "$", message: "Expected a top-level object." }],
    };
  }

  isExactKeySet(value, Object.values(TOP_LEVEL_KEYS), "$", issues);

  if (value.version !== CONFIG_VERSION) {
    issues.push({ path: "version", message: "Expected version 1." });
  }

  if (value.defaultAction !== DEFAULT_ACTION.DENY) {
    issues.push({ path: "defaultAction", message: "Expected 'deny'." });
  }

  if (value.symlinkPolicy !== SYMLINK_POLICY.DENY) {
    issues.push({ path: "symlinkPolicy", message: "Expected 'deny'." });
  }

  const rawRules = value.rules;

  if (!Array.isArray(rawRules)) {
    issues.push({ path: "rules", message: "Expected an array of rules." });
  }

  const rules = Array.isArray(rawRules)
    ? rawRules
        .map((rule, index) => validateRule(rule, index, issues))
        .filter((rule): rule is GuardRule => rule !== null)
    : [];

  const ruleIds = new Set<string>();

  for (const rule of rules) {
    if (ruleIds.has(rule.id)) {
      issues.push({ path: "rules", message: `Duplicate rule id '${rule.id}'.` });
      continue;
    }

    ruleIds.add(rule.id);
  }

  if (
    issues.length > 0 ||
    value.version !== CONFIG_VERSION ||
    value.defaultAction !== DEFAULT_ACTION.DENY ||
    value.symlinkPolicy !== SYMLINK_POLICY.DENY ||
    !Array.isArray(rawRules)
  ) {
    return {
      ok: false,
      issues,
    };
  }

  return {
    ok: true,
    issues,
    config: {
      version: CONFIG_VERSION,
      defaultAction: DEFAULT_ACTION.DENY,
      symlinkPolicy: SYMLINK_POLICY.DENY,
      rules,
    },
  };
}
