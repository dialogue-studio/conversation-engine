import type { Scenario } from './index.js';
import { validateGraph } from './validation/graph-validator.js';
import type {
  ScenarioValidationIssue,
  ValidationIssues,
} from './validation/issues.js';
import { parseScenario } from './validation/scenario-parser.js';

export type { ScenarioValidationIssue } from './validation/issues.js';

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
  const issues: ValidationIssues = [];
  const scenario = parseScenario(input, issues);

  if (!scenario) {
    return { issues, success: false };
  }

  validateGraph(scenario, issues);

  return issues.length === 0
    ? { data: scenario, issues: [], success: true }
    : { issues, success: false };
}
