import type { ValidationIssues, ValidationPath } from './issues.js';
import { reportUnexpectedProperty } from './issues.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateKnownKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: ValidationPath,
  issues: ValidationIssues,
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      reportUnexpectedProperty(issues, path, key);
    }
  }
}
