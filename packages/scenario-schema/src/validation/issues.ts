export type ValidationPath = readonly (number | string)[];

export interface ScenarioValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: ValidationPath;
}

export type ValidationIssues = ScenarioValidationIssue[];

export function reportGraphViolation(
  issues: ValidationIssues,
  path: ValidationPath,
  code: string,
  message: string,
): void {
  appendIssue(issues, path, code, message);
}

export function reportInvalidType(
  issues: ValidationIssues,
  path: ValidationPath,
  message: string,
): void {
  appendIssue(issues, path, 'invalid_type', message);
}

export function reportInvalidValue(
  issues: ValidationIssues,
  path: ValidationPath,
  message: string,
): void {
  appendIssue(issues, path, 'invalid_value', message);
}

export function reportUnexpectedProperty(
  issues: ValidationIssues,
  path: ValidationPath,
  property: string,
): void {
  appendIssue(
    issues,
    [...path, property],
    'unexpected_property',
    `"${property}" is not supported in this object.`,
  );
}

function appendIssue(
  issues: ValidationIssues,
  path: ValidationPath,
  code: string,
  message: string,
): void {
  issues.push({ code, message, path });
}
