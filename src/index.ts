export { CONFIG_FILENAME, CONFIG_VERSION, DEFAULT_ACTION, SYMLINK_POLICY, type GuardAction, type SymlinkPolicy } from "./config/constants.js";
export type { GuardConfig, GuardRule, LoadedGuardConfig, ValidationIssue, ValidationResult } from "./config/types.js";
export { GuardConfigError, loadGuardConfig } from "./config/load.js";
export { validateGuardConfig } from "./config/validate.js";
export { GuardPathError, canonicalizeTargetPath } from "./core/paths.js";
export { GuardRequestError, prepareOperationRequest } from "./core/request.js";
export type { GuardDecision, OperationRequest, PreparedOperationRequest } from "./core/types.js";
export { evaluateOperation } from "./core/evaluate.js";
export { evaluateHostOperation } from "./host/adapter.js";
export {
  classifyTargetPathKind,
  createReportedDecision,
  type AuditContext,
  type ReportedDecision,
} from "./host/reporting.js";
export {
  AUDIT_TARGET_PATH_KIND,
  HOST_FAILURE_STAGE,
  HOST_REASON_CODE,
  type AuditTargetPathKind,
  type EvaluateHostOperationOptions,
  type HostAuditRecord,
  type HostEvaluationResult,
  type HostFailureStage,
  type HostOperationInput,
  type HostReasonCode,
} from "./host/types.js";
