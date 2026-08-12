import type { Scenario, ScenarioNode, ScenarioObjective } from '../index.js';

import type { ValidationIssues, ValidationPath } from './issues.js';
import { reportInvalidType, reportInvalidValue } from './issues.js';
import { parseNode } from './node-parser.js';
import { createOptionalProperty } from './optional-properties.js';
import { readLiteralOne, readPositiveInteger, readBoolean } from './readers.js';
import { isRecord, validateKnownKeys } from './records.js';
import { readNonEmptyString, readOptionalString } from './text-readers.js';

export function parseScenario(
  input: unknown,
  issues: ValidationIssues,
): Scenario | null {
  if (!isRecord(input)) {
    reportInvalidType(issues, [], 'Scenario must be an object.');
    return null;
  }

  validateKnownKeys(
    input,
    [
      'description',
      'id',
      'initialNodeId',
      'nodes',
      'objectives',
      'schemaVersion',
      'title',
      'version',
    ],
    [],
    issues,
  );
  const description = readOptionalString(input, 'description', [], issues);
  const id = readNonEmptyString(input, 'id', [], issues);
  const initialNodeId = readNonEmptyString(input, 'initialNodeId', [], issues);
  const nodes = parseNodes(input.nodes, ['nodes'], issues);
  const objectives = parseObjectives(input.objectives, ['objectives'], issues);
  const schemaVersion = readLiteralOne(input, 'schemaVersion', [], issues);
  const title = readNonEmptyString(input, 'title', [], issues);
  const version = readPositiveInteger(input, 'version', [], issues);

  if (
    !id ||
    !initialNodeId ||
    !nodes ||
    !objectives ||
    !schemaVersion ||
    !title ||
    !version
  ) {
    return null;
  }

  return {
    ...createOptionalProperty('description', description),
    id,
    initialNodeId,
    nodes,
    objectives,
    schemaVersion,
    title,
    version,
  };
}

function parseNodes(
  value: unknown,
  path: ValidationPath,
  issues: ValidationIssues,
): Readonly<Record<string, ScenarioNode>> | null {
  if (!isRecord(value)) {
    reportInvalidType(issues, path, 'Nodes must be an object.');
    return null;
  }

  const entries = Object.entries(value);

  if (entries.length === 0) {
    reportInvalidValue(
      issues,
      path,
      'A scenario must contain at least one node.',
    );
    return null;
  }

  const nodes: Record<string, ScenarioNode> = {};

  for (const [nodeKey, nodeValue] of entries) {
    const node = parseNode(nodeValue, [...path, nodeKey], issues);

    if (node) {
      nodes[nodeKey] = node;
    }
  }

  return Object.keys(nodes).length === entries.length ? nodes : null;
}

function parseObjectives(
  value: unknown,
  path: ValidationPath,
  issues: ValidationIssues,
): readonly ScenarioObjective[] | null {
  if (!Array.isArray(value)) {
    reportInvalidType(issues, path, 'Objectives must be an array.');
    return null;
  }

  const objectives: ScenarioObjective[] = [];

  for (const [index, valueAtIndex] of value.entries()) {
    const objectivePath = [...path, index];

    if (!isRecord(valueAtIndex)) {
      reportInvalidType(
        issues,
        objectivePath,
        'Each objective must be an object.',
      );
      continue;
    }

    validateKnownKeys(
      valueAtIndex,
      ['id', 'required', 'title'],
      objectivePath,
      issues,
    );
    const id = readNonEmptyString(valueAtIndex, 'id', objectivePath, issues);
    const required = readBoolean(
      valueAtIndex,
      'required',
      objectivePath,
      issues,
    );
    const title = readNonEmptyString(
      valueAtIndex,
      'title',
      objectivePath,
      issues,
    );

    if (id && required !== null && title) {
      objectives.push({ id, required, title });
    }
  }

  return objectives.length === value.length ? objectives : null;
}
