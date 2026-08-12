import type { ButtonLayout, Transition } from '../index.js';

import type { ValidationIssues, ValidationPath } from './issues.js';
import { reportInvalidType } from './issues.js';
import {
  readIntegerInRange,
  readOptionalBoolean,
  readOptionalStringArray,
  readTransitionKind,
} from './readers.js';
import { isRecord, validateKnownKeys } from './records.js';
import { readNonEmptyString } from './text-readers.js';

export function parseOptionalButtonLayout(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): ButtonLayout | null {
  const property = value[key];

  if (property === undefined) {
    return null;
  }

  if (!isRecord(property)) {
    reportInvalidType(issues, [...path, key], `"${key}" must be an object.`);
    return null;
  }

  validateKnownKeys(property, ['columns'], [...path, key], issues);
  const columns = readIntegerInRange(
    property,
    'columns',
    1,
    5,
    [...path, key],
    issues,
  );

  return columns === null ? null : { columns };
}

export function parseTransitions(
  value: unknown,
  path: ValidationPath,
  issues: ValidationIssues,
): readonly Transition[] | null {
  if (!Array.isArray(value)) {
    reportInvalidType(issues, path, 'Transitions must be an array.');
    return null;
  }

  const transitions: Transition[] = [];

  for (const [index, valueAtIndex] of value.entries()) {
    const transition = parseTransition(valueAtIndex, [...path, index], issues);

    if (transition) {
      transitions.push(transition);
    }
  }

  return transitions.length === value.length ? transitions : null;
}

function parseTransition(
  value: unknown,
  path: ValidationPath,
  issues: ValidationIssues,
): Transition | null {
  if (!isRecord(value)) {
    reportInvalidType(issues, path, 'Each transition must be an object.');
    return null;
  }

  validateKnownKeys(
    value,
    [
      'actionId',
      'hideWhenTargetVisited',
      'kind',
      'label',
      'requiresCompletedObjectiveIds',
      'targetNodeId',
    ],
    path,
    issues,
  );
  const actionId = readNonEmptyString(value, 'actionId', path, issues);
  const hideWhenTargetVisited = readOptionalBoolean(
    value,
    'hideWhenTargetVisited',
    path,
    issues,
  );
  const kind = readTransitionKind(value, 'kind', path, issues);
  const label = readNonEmptyString(value, 'label', path, issues);
  const requiresCompletedObjectiveIds = readOptionalStringArray(
    value,
    'requiresCompletedObjectiveIds',
    path,
    issues,
  );
  const targetNodeId = readNonEmptyString(value, 'targetNodeId', path, issues);

  if (
    !actionId ||
    !kind ||
    !label ||
    !targetNodeId ||
    (value.hideWhenTargetVisited !== undefined &&
      hideWhenTargetVisited === null)
  ) {
    return null;
  }

  return {
    ...(hideWhenTargetVisited === true ? { hideWhenTargetVisited } : {}),
    ...(requiresCompletedObjectiveIds ? { requiresCompletedObjectiveIds } : {}),
    actionId,
    kind,
    label,
    targetNodeId,
  };
}
