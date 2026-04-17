import type { GuardAction } from "./constants.js";

export interface GuardRule {
  id: string;
  action: GuardAction;
  command: string;
  pathPrefix: string;
}

export interface GuardConfig {
  version: 1;
  defaultAction: "deny";
  rules: GuardRule[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}
