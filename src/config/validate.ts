import { DEFAULT_ACTION } from "./constants.js";
import type { GuardConfig, GuardRule, ValidationIssue, ValidationResult } from "./types.js";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGuardAction(value: unknown): value is GuardRule["action"] {
  return value === DEFAULT_ACTION.ALLOW || value === DEFAULT_ACTION.DENY;
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

function validateRule(value: unknown, index: number, issues: ValidationIssue[]): GuardRule | null {
  const pathBase = `rules[${index}]`;

  if (!isObjectRecord(value)) {
    issues.push({ path: pathBase, message: "Expected an object rule." });
    return null;
  }

  const id = readNonEmptyString(value.id, `${pathBase}.id`, issues);
  const command = readNonEmptyString(value.command, `${pathBase}.command`, issues);
  const pathPrefix = readNonEmptyString(value.pathPrefix, `${pathBase}.pathPrefix`, issues);

  if (!isGuardAction(value.action)) {
    issues.push({ path: `${pathBase}.action`, message: "Expected 'allow' or 'deny'." });
  }

  if (id === null || command === null || pathPrefix === null || !isGuardAction(value.action)) {
    return null;
  }

  if (!pathPrefix.startsWith("/")) {
    issues.push({ path: `${pathBase}.pathPrefix`, message: "Expected an absolute path prefix." });
    return null;
  }

  return {
    id,
    action: value.action,
    command,
    pathPrefix,
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

  if (value.version !== 1) {
    issues.push({ path: "version", message: "Expected version 1." });
  }

  if (value.defaultAction !== DEFAULT_ACTION.DENY) {
    issues.push({ path: "defaultAction", message: "Expected 'deny' for the bootstrap milestone." });
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

  if (issues.length > 0 || value.version !== 1 || value.defaultAction !== DEFAULT_ACTION.DENY || !Array.isArray(rawRules)) {
    return {
      ok: false,
      issues,
    };
  }

  return {
    ok: true,
    issues,
    config: {
      version: 1,
      defaultAction: DEFAULT_ACTION.DENY,
      rules,
    },
  };
}
