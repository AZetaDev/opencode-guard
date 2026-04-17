export { CONFIG_FILENAME, DEFAULT_ACTION, type GuardAction } from "./config/constants.js";
export type { GuardConfig, GuardRule, ValidationIssue, ValidationResult } from "./config/types.js";
export { validateGuardConfig } from "./config/validate.js";
export type { GuardDecision, OperationRequest } from "./core/types.js";
export { evaluateOperation } from "./core/evaluate.js";
