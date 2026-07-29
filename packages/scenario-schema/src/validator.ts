import type {
  ButtonLayout,
  Scenario,
  ScenarioNode,
  ScenarioObjective,
  Transition,
  TransitionKind,
} from './index.js';

export interface ScenarioValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: readonly (number | string)[];
}

export type ScenarioValidationResult =
  | {
      readonly data: Scenario;
      readonly issues: readonly [];
      readonly success: true;
    }
  | {
      readonly data?: undefined;
      readonly issues: readonly ScenarioValidationIssue[];
      readonly success: false;
    };

/**
 * Validates untrusted, serialized scenario content before it is published or
 * passed to the runtime. JSON Schema covers the structural contract; this
 * function additionally verifies graph relationships and learning semantics.
 */
export function validateScenario(input: unknown): ScenarioValidationResult {
  const issues: ScenarioValidationIssue[] = [];
  const scenario = parseScenario(input, issues);

  if (!scenario) {
    return { issues, success: false };
  }

  validateGraph(scenario, issues);

  return issues.length === 0
    ? { data: scenario, issues: [], success: true }
    : { issues, success: false };
}

function parseScenario(
  input: unknown,
  issues: ScenarioValidationIssue[],
): Scenario | null {
  if (!isRecord(input)) {
    addIssue(issues, [], 'invalid_type', 'Scenario must be an object.');
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

  const id = readNonEmptyString(input, 'id', [], issues);
  const initialNodeId = readNonEmptyString(input, 'initialNodeId', [], issues);
  const title = readNonEmptyString(input, 'title', [], issues);
  const version = readPositiveInteger(input, 'version', [], issues);
  const schemaVersion = readLiteralOne(input, 'schemaVersion', [], issues);
  const description = readOptionalString(input, 'description', [], issues);
  const objectives = parseObjectives(input.objectives, ['objectives'], issues);
  const nodes = parseNodes(input.nodes, ['nodes'], issues);

  if (
    !id ||
    !initialNodeId ||
    !title ||
    !version ||
    !schemaVersion ||
    !objectives ||
    !nodes
  ) {
    return null;
  }

  return {
    ...(description !== null ? { description } : {}),
    id,
    initialNodeId,
    nodes,
    objectives,
    schemaVersion,
    title,
    version,
  };
}

function parseObjectives(
  value: unknown,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): readonly ScenarioObjective[] | null {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'invalid_type', 'Objectives must be an array.');
    return null;
  }

  const objectives: ScenarioObjective[] = [];

  for (const [index, valueAtIndex] of value.entries()) {
    const objectivePath = [...path, index];

    if (!isRecord(valueAtIndex)) {
      addIssue(
        issues,
        objectivePath,
        'invalid_type',
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
    const title = readNonEmptyString(
      valueAtIndex,
      'title',
      objectivePath,
      issues,
    );
    const required = readBoolean(
      valueAtIndex,
      'required',
      objectivePath,
      issues,
    );

    if (!id || !title || required === null) {
      continue;
    }

    objectives.push({ id, required, title });
  }

  return objectives.length === value.length ? objectives : null;
}

function parseNodes(
  value: unknown,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): Readonly<Record<string, ScenarioNode>> | null {
  if (!isRecord(value)) {
    addIssue(issues, path, 'invalid_type', 'Nodes must be an object.');
    return null;
  }

  const entries = Object.entries(value);

  if (entries.length === 0) {
    addIssue(
      issues,
      path,
      'invalid_value',
      'A scenario must contain at least one node.',
    );
    return null;
  }

  const nodes: Record<string, ScenarioNode> = {};

  for (const [nodeKey, nodeValue] of entries) {
    const nodePath = [...path, nodeKey];
    const node = parseNode(nodeValue, nodePath, issues);

    if (!node) {
      continue;
    }

    nodes[nodeKey] = node;
  }

  return Object.keys(nodes).length === entries.length ? nodes : null;
}

function parseNode(
  value: unknown,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): ScenarioNode | null {
  if (!isRecord(value)) {
    addIssue(issues, path, 'invalid_type', 'Each node must be an object.');
    return null;
  }

  validateKnownKeys(
    value,
    [
      'buttonLayout',
      'completesObjectiveIds',
      'id',
      'kind',
      'message',
      'speaker',
      'title',
      'transitions',
    ],
    path,
    issues,
  );
  const id = readNonEmptyString(value, 'id', path, issues);
  const buttonLayout = parseOptionalButtonLayout(
    value,
    'buttonLayout',
    path,
    issues,
  );
  const title = readNonEmptyString(value, 'title', path, issues);
  const message = readNonEmptyString(value, 'message', path, issues);
  const kind = readNodeKind(value, 'kind', path, issues);
  const speaker = readOptionalNonEmptyString(value, 'speaker', path, issues);
  const completesObjectiveIds = readStringArray(
    value,
    'completesObjectiveIds',
    path,
    issues,
  );
  const transitions = parseTransitions(
    value.transitions,
    [...path, 'transitions'],
    issues,
  );

  if (
    !id ||
    (value.buttonLayout !== undefined && !buttonLayout) ||
    !title ||
    !message ||
    !kind ||
    !completesObjectiveIds ||
    !transitions
  ) {
    return null;
  }

  return {
    ...(buttonLayout ? { buttonLayout } : {}),
    ...(speaker !== null ? { speaker } : {}),
    completesObjectiveIds,
    id,
    kind,
    message,
    title,
    transitions,
  };
}

function parseTransitions(
  value: unknown,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): readonly Transition[] | null {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'invalid_type', 'Transitions must be an array.');
    return null;
  }

  const transitions: Transition[] = [];

  for (const [index, valueAtIndex] of value.entries()) {
    const transitionPath = [...path, index];

    if (!isRecord(valueAtIndex)) {
      addIssue(
        issues,
        transitionPath,
        'invalid_type',
        'Each transition must be an object.',
      );
      continue;
    }

    validateKnownKeys(
      valueAtIndex,
      [
        'actionId',
        'hideWhenTargetVisited',
        'kind',
        'label',
        'requiresCompletedObjectiveIds',
        'targetNodeId',
      ],
      transitionPath,
      issues,
    );
    const actionId = readNonEmptyString(
      valueAtIndex,
      'actionId',
      transitionPath,
      issues,
    );
    const hideWhenTargetVisited = readOptionalBoolean(
      valueAtIndex,
      'hideWhenTargetVisited',
      transitionPath,
      issues,
    );
    const kind = readTransitionKind(
      valueAtIndex,
      'kind',
      transitionPath,
      issues,
    );
    const label = readNonEmptyString(
      valueAtIndex,
      'label',
      transitionPath,
      issues,
    );
    const targetNodeId = readNonEmptyString(
      valueAtIndex,
      'targetNodeId',
      transitionPath,
      issues,
    );
    const requiresCompletedObjectiveIds = readOptionalStringArray(
      valueAtIndex,
      'requiresCompletedObjectiveIds',
      transitionPath,
      issues,
    );

    if (
      !actionId ||
      !kind ||
      !label ||
      !targetNodeId ||
      (valueAtIndex.hideWhenTargetVisited !== undefined &&
        hideWhenTargetVisited === null)
    ) {
      continue;
    }

    transitions.push({
      ...(hideWhenTargetVisited === true ? { hideWhenTargetVisited } : {}),
      ...(requiresCompletedObjectiveIds
        ? { requiresCompletedObjectiveIds }
        : {}),
      actionId,
      kind,
      label,
      targetNodeId,
    });
  }

  return transitions.length === value.length ? transitions : null;
}

function parseOptionalButtonLayout(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): ButtonLayout | null {
  const property = value[key];

  if (property === undefined) {
    return null;
  }

  if (!isRecord(property)) {
    addIssue(
      issues,
      [...path, key],
      'invalid_type',
      `"${key}" must be an object.`,
    );
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

function validateGraph(
  scenario: Scenario,
  issues: ScenarioValidationIssue[],
): void {
  const objectiveIds = new Set<string>();

  for (const [index, objective] of scenario.objectives.entries()) {
    if (objectiveIds.has(objective.id)) {
      addIssue(
        issues,
        ['objectives', index, 'id'],
        'duplicate_objective_id',
        `Objective ID "${objective.id}" is duplicated.`,
      );
    }

    objectiveIds.add(objective.id);
  }

  if (!scenario.nodes[scenario.initialNodeId]) {
    addIssue(
      issues,
      ['initialNodeId'],
      'missing_initial_node',
      `Initial node "${scenario.initialNodeId}" does not exist.`,
    );
  }

  const actionIds = new Set<string>();
  const completedObjectiveIds = new Set<string>();
  let completionNodeCount = 0;

  for (const [nodeKey, node] of Object.entries(scenario.nodes)) {
    const nodePath = ['nodes', nodeKey] as const;

    if (node.id !== nodeKey) {
      addIssue(
        issues,
        [...nodePath, 'id'],
        'node_key_mismatch',
        `Node key "${nodeKey}" must equal node ID "${node.id}".`,
      );
    }

    if (node.kind === 'completion') {
      completionNodeCount += 1;

      if (node.transitions.length > 0) {
        addIssue(
          issues,
          [...nodePath, 'transitions'],
          'completion_has_transitions',
          'A completion node cannot have outgoing transitions.',
        );
      }
    } else if (node.transitions.length === 0) {
      addIssue(
        issues,
        [...nodePath, 'transitions'],
        'message_without_transitions',
        'A message node without outgoing transitions must be a completion node.',
      );
    }

    for (const objectiveId of node.completesObjectiveIds) {
      completedObjectiveIds.add(objectiveId);

      if (!objectiveIds.has(objectiveId)) {
        addIssue(
          issues,
          [...nodePath, 'completesObjectiveIds'],
          'unknown_objective',
          `Node completes unknown objective "${objectiveId}".`,
        );
      }
    }

    for (const [index, transition] of node.transitions.entries()) {
      const transitionPath = [...nodePath, 'transitions', index] as const;
      const targetNode = scenario.nodes[transition.targetNodeId];

      if (actionIds.has(transition.actionId)) {
        addIssue(
          issues,
          [...transitionPath, 'actionId'],
          'duplicate_action_id',
          `Action ID "${transition.actionId}" is duplicated.`,
        );
      }

      actionIds.add(transition.actionId);

      if (!targetNode) {
        addIssue(
          issues,
          [...transitionPath, 'targetNodeId'],
          'missing_transition_target',
          `Transition targets missing node "${transition.targetNodeId}".`,
        );
      } else {
        if (transition.kind === 'finish' && targetNode.kind !== 'completion') {
          addIssue(
            issues,
            [...transitionPath, 'targetNodeId'],
            'finish_target_not_completion',
            'A finish transition must target a completion node.',
          );
        }

        if (transition.kind !== 'finish' && targetNode.kind === 'completion') {
          addIssue(
            issues,
            [...transitionPath, 'kind'],
            'completion_target_not_finish',
            'Only a finish transition can target a completion node.',
          );
        }

        if (transition.kind === 'hint' && targetNode.kind !== 'message') {
          addIssue(
            issues,
            [...transitionPath, 'targetNodeId'],
            'hint_target_not_message',
            'A hint transition must target a message node.',
          );
        }
      }

      for (const objectiveId of transition.requiresCompletedObjectiveIds ??
        []) {
        if (!objectiveIds.has(objectiveId)) {
          addIssue(
            issues,
            [...transitionPath, 'requiresCompletedObjectiveIds'],
            'unknown_objective',
            `Transition requires unknown objective "${objectiveId}".`,
          );
        }
      }
    }
  }

  if (completionNodeCount === 0) {
    addIssue(
      issues,
      ['nodes'],
      'missing_completion_node',
      'A scenario must contain at least one completion node.',
    );
  }

  for (const objective of scenario.objectives) {
    if (objective.required && !completedObjectiveIds.has(objective.id)) {
      addIssue(
        issues,
        ['objectives'],
        'uncompletable_required_objective',
        `Required objective "${objective.id}" is not completed by any node.`,
      );
    }
  }

  validateReachability(scenario, issues);
}

function validateReachability(
  scenario: Scenario,
  issues: ScenarioValidationIssue[],
): void {
  const reachableNodeIds = new Set<string>();
  const pendingNodeIds = [scenario.initialNodeId];

  while (pendingNodeIds.length > 0) {
    const nodeId = pendingNodeIds.pop();

    if (!nodeId || reachableNodeIds.has(nodeId)) {
      continue;
    }

    const node = scenario.nodes[nodeId];

    if (!node) {
      continue;
    }

    reachableNodeIds.add(nodeId);

    for (const { targetNodeId } of node.transitions) {
      pendingNodeIds.push(targetNodeId);
    }
  }

  for (const nodeId of Object.keys(scenario.nodes)) {
    if (!reachableNodeIds.has(nodeId)) {
      addIssue(
        issues,
        ['nodes', nodeId],
        'unreachable_node',
        `Node "${nodeId}" cannot be reached from the initial node.`,
      );
    }
  }

  const completionIsReachable = [...reachableNodeIds].some(
    (nodeId) => scenario.nodes[nodeId]?.kind === 'completion',
  );

  if (!completionIsReachable) {
    addIssue(
      issues,
      ['initialNodeId'],
      'completion_unreachable',
      'No completion node can be reached from the initial node.',
    );
  }
}

function readBoolean(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): boolean | null {
  const property = value[key];

  if (typeof property === 'boolean') {
    return property;
  }

  addIssue(
    issues,
    [...path, key],
    'invalid_type',
    `"${key}" must be a boolean.`,
  );
  return null;
}

function readOptionalBoolean(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): boolean | null {
  if (value[key] === undefined) {
    return null;
  }

  return readBoolean(value, key, path, issues);
}

function readLiteralOne(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): 1 | null {
  if (value[key] === 1) {
    return 1;
  }

  addIssue(issues, [...path, key], 'invalid_value', `"${key}" must be 1.`);
  return null;
}

function readNodeKind(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): ScenarioNode['kind'] | null {
  const property = value[key];

  if (property === 'completion' || property === 'message') {
    return property;
  }

  addIssue(
    issues,
    [...path, key],
    'invalid_value',
    `"${key}" must be "completion" or "message".`,
  );
  return null;
}

function readNonEmptyString(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): string | null {
  const property = value[key];

  if (typeof property === 'string' && property.trim().length > 0) {
    return property;
  }

  addIssue(
    issues,
    [...path, key],
    'invalid_value',
    `"${key}" must be a non-empty string.`,
  );
  return null;
}

function readOptionalNonEmptyString(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): string | null {
  const property = value[key];

  if (property === undefined) {
    return null;
  }

  if (typeof property === 'string' && property.trim().length > 0) {
    return property;
  }

  addIssue(
    issues,
    [...path, key],
    'invalid_type',
    `"${key}" must be a non-empty string.`,
  );
  return null;
}

function readOptionalString(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): string | null {
  const property = value[key];

  if (property === undefined) {
    return null;
  }

  if (typeof property === 'string') {
    return property;
  }

  addIssue(
    issues,
    [...path, key],
    'invalid_type',
    `"${key}" must be a string.`,
  );
  return null;
}

function readOptionalStringArray(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): readonly string[] | null {
  if (value[key] === undefined) {
    return null;
  }

  return readStringArray(value, key, path, issues);
}

function readPositiveInteger(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): number | null {
  const property = value[key];

  if (
    typeof property === 'number' &&
    Number.isSafeInteger(property) &&
    property > 0
  ) {
    return property;
  }

  addIssue(
    issues,
    [...path, key],
    'invalid_value',
    `"${key}" must be a positive integer.`,
  );
  return null;
}

function readIntegerInRange(
  value: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): number | null {
  const property = value[key];

  if (
    typeof property === 'number' &&
    Number.isSafeInteger(property) &&
    property >= minimum &&
    property <= maximum
  ) {
    return property;
  }

  addIssue(
    issues,
    [...path, key],
    'invalid_value',
    `"${key}" must be an integer from ${String(minimum)} to ${String(maximum)}.`,
  );
  return null;
}

function readStringArray(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): readonly string[] | null {
  const property = value[key];

  if (!Array.isArray(property)) {
    addIssue(
      issues,
      [...path, key],
      'invalid_type',
      `"${key}" must be an array of non-empty strings.`,
    );
    return null;
  }

  const strings: string[] = [];

  for (const item of property) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      addIssue(
        issues,
        [...path, key],
        'invalid_type',
        `"${key}" must be an array of non-empty strings.`,
      );
      return null;
    }

    strings.push(item);
  }

  return strings;
}

function readTransitionKind(
  value: Record<string, unknown>,
  key: string,
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): TransitionKind | null {
  const property = value[key];

  if (
    property === 'choice' ||
    property === 'finish' ||
    property === 'hint' ||
    property === 'navigation'
  ) {
    return property;
  }

  addIssue(
    issues,
    [...path, key],
    'invalid_value',
    `"${key}" must be a supported transition kind.`,
  );
  return null;
}

function validateKnownKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: readonly (number | string)[],
  issues: ScenarioValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      addIssue(
        issues,
        [...path, key],
        'unexpected_property',
        `"${key}" is not supported in this object.`,
      );
    }
  }
}

function addIssue(
  issues: ScenarioValidationIssue[],
  path: readonly (number | string)[],
  code: string,
  message: string,
): void {
  issues.push({ code, message, path });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
