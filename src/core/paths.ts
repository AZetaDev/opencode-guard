import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

import { SYMLINK_POLICY, type SymlinkPolicy } from "../config/constants.js";

export class GuardPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardPathError";
  }
}

export interface CanonicalizationOptions {
  workspaceRoot: string;
  targetPath: string;
  symlinkPolicy: SymlinkPolicy;
}

export interface CanonicalPathInfo {
  workspaceRoot: string;
  canonicalTargetPath: string;
  targetPathExists: boolean;
}

function normalizeAbsolutePath(input: string): string {
  const normalizedValue = path.normalize(input.trim());

  if (normalizedValue.includes("\u0000")) {
    throw new GuardPathError("Path contains a null byte.");
  }

  if (!path.isAbsolute(normalizedValue)) {
    throw new GuardPathError("Expected an absolute path.");
  }

  if (normalizedValue !== path.parse(normalizedValue).root && normalizedValue.endsWith(path.sep)) {
    return normalizedValue.slice(0, -1);
  }

  return normalizedValue;
}

function isWithinParent(parentPath: string, childPath: string): boolean {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function pathExists(pathValue: string): Promise<boolean> {
  try {
    await lstat(pathValue);
    return true;
  } catch {
    return false;
  }
}

async function assertNoSymlink(pathValue: string): Promise<void> {
  const stats = await lstat(pathValue);

  if (stats.isSymbolicLink()) {
    throw new GuardPathError(`Symlink access is denied for '${pathValue}'.`);
  }
}

async function assertNoSymlinkPathSegments(startPath: string, targetPath: string): Promise<void> {
  const relativePath = path.relative(startPath, targetPath);

  if (relativePath === "") {
    return;
  }

  const segments = relativePath.split(path.sep).filter((segment) => segment.length > 0);
  let currentPath = startPath;

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);

    if (!(await pathExists(currentPath))) {
      return;
    }

    await assertNoSymlink(currentPath);
  }
}

export async function canonicalizeTargetPath(options: CanonicalizationOptions): Promise<CanonicalPathInfo> {
  const normalizedWorkspaceRoot = normalizeAbsolutePath(options.workspaceRoot);

  if (options.symlinkPolicy !== SYMLINK_POLICY.DENY) {
    throw new GuardPathError("Unsupported symlink policy.");
  }

  const workspaceRootRealPath = await realpath(normalizedWorkspaceRoot);
  const normalizedWorkspaceRealPath = normalizeAbsolutePath(workspaceRootRealPath);

  if (normalizedWorkspaceRealPath !== normalizedWorkspaceRoot) {
    throw new GuardPathError("Workspace root must not be a symlinked path.");
  }

  await assertNoSymlink(normalizedWorkspaceRoot);

  const candidateTargetPath = path.isAbsolute(options.targetPath)
    ? options.targetPath
    : path.join(normalizedWorkspaceRoot, options.targetPath);

  const normalizedTargetPath = normalizeAbsolutePath(candidateTargetPath);

  if (!isWithinParent(normalizedWorkspaceRoot, normalizedTargetPath)) {
    throw new GuardPathError("Target path escapes the workspace root.");
  }

  await assertNoSymlinkPathSegments(normalizedWorkspaceRoot, normalizedTargetPath);

  const targetPathExists = await pathExists(normalizedTargetPath);

  if (!targetPathExists) {
    return {
      workspaceRoot: normalizedWorkspaceRoot,
      canonicalTargetPath: normalizedTargetPath,
      targetPathExists: false,
    };
  }

  const targetRealPath = normalizeAbsolutePath(await realpath(normalizedTargetPath));

  if (!isWithinParent(normalizedWorkspaceRoot, targetRealPath)) {
    throw new GuardPathError("Resolved target path escapes the workspace root.");
  }

  if (targetRealPath !== normalizedTargetPath) {
    throw new GuardPathError("Symlink access is denied for the target path.");
  }

  return {
    workspaceRoot: normalizedWorkspaceRoot,
    canonicalTargetPath: targetRealPath,
    targetPathExists: true,
  };
}
