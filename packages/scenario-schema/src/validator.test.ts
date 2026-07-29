import type { Scenario } from './index.ts';
import { validateScenario } from './index.ts';
import { describe, expect, it } from 'vitest';

const validScenario = {
  id: 'bank-discovery',
  initialNodeId: 'intro',
  nodes: {
    finish: {
      completesObjectiveIds: [],
      id: 'finish',
      kind: 'completion',
      message: 'Thank you.',
      title: 'Finish',
      transitions: [],
    },
    intro: {
      buttonLayout: { columns: 2 },
      completesObjectiveIds: [],
      id: 'intro',
      kind: 'message',
      message: 'What would you like to learn?',
      title: 'Introduction',
      transitions: [
        {
          actionId: 'ask-about-bank',
          hideWhenTargetVisited: true,
          kind: 'choice',
          label: 'Tell me about the bank',
          targetNodeId: 'bank',
        },
      ],
    },
    bank: {
      completesObjectiveIds: ['bank-overview'],
      id: 'bank',
      kind: 'message',
      message: 'The bank supports corporate growth.',
      title: 'About the bank',
      transitions: [
        {
          actionId: 'finish-conversation',
          kind: 'finish',
          label: 'Finish conversation',
          targetNodeId: 'finish',
        },
      ],
    },
  },
  objectives: [
    { id: 'bank-overview', required: true, title: 'Understand the bank' },
  ],
  schemaVersion: 1,
  title: 'Bank discovery',
  version: 1,
} as const satisfies Scenario;

describe('validateScenario', () => {
  it('accepts a structurally and semantically valid scenario', () => {
    const result = validateScenario(validScenario);

    expect(result).toEqual({ data: validScenario, issues: [], success: true });
  });

  it('rejects unexpected fields and invalid scalar values', () => {
    const result = validateScenario({
      ...validScenario,
      extra: true,
      version: 0,
    });

    expect(result.success).toBe(false);
    expect(result.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['invalid_value', 'unexpected_property']),
    );
  });

  it('rejects an empty optional speaker name', () => {
    const result = validateScenario({
      ...validScenario,
      nodes: {
        ...validScenario.nodes,
        intro: {
          ...validScenario.nodes.intro,
          speaker: '',
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.issues.map(({ code }) => code)).toContain('invalid_type');
  });

  it('rejects a button layout outside the supported column range', () => {
    const result = validateScenario({
      ...validScenario,
      nodes: {
        ...validScenario.nodes,
        intro: {
          ...validScenario.nodes.intro,
          buttonLayout: { columns: 6 },
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.issues.map(({ code }) => code)).toContain('invalid_value');
  });

  it('rejects an invalid finish transition', () => {
    const result = validateScenario({
      ...validScenario,
      nodes: {
        ...validScenario.nodes,
        intro: {
          ...validScenario.nodes.intro,
          transitions: [
            {
              actionId: 'invalid-finish',
              kind: 'finish',
              label: 'Finish too early',
              targetNodeId: 'bank',
            },
          ],
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.issues.map(({ code }) => code)).toContain(
      'finish_target_not_completion',
    );
  });

  it('reports broken graph relationships', () => {
    const result = validateScenario({
      ...validScenario,
      nodes: {
        ...validScenario.nodes,
        intro: {
          ...validScenario.nodes.intro,
          completesObjectiveIds: ['unknown-objective'],
          id: 'different-id',
          transitions: [
            {
              actionId: 'duplicate-action',
              kind: 'choice',
              label: 'Missing target',
              requiresCompletedObjectiveIds: ['unknown-objective'],
              targetNodeId: 'missing-node',
            },
            {
              actionId: 'duplicate-action',
              kind: 'finish',
              label: 'Invalid finish',
              targetNodeId: 'bank',
            },
          ],
        },
      },
      objectives: [
        ...validScenario.objectives,
        { id: 'bank-overview', required: true, title: 'Duplicated objective' },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'duplicate_action_id',
        'duplicate_objective_id',
        'finish_target_not_completion',
        'missing_transition_target',
        'node_key_mismatch',
        'unknown_objective',
      ]),
    );
  });

  it('rejects a graph without a reachable completion node', () => {
    const result = validateScenario({
      ...validScenario,
      nodes: {
        finish: validScenario.nodes.finish,
        intro: {
          ...validScenario.nodes.intro,
          transitions: [
            {
              actionId: 'continue',
              kind: 'navigation',
              label: 'Continue',
              targetNodeId: 'loop',
            },
          ],
        },
        loop: {
          completesObjectiveIds: [],
          id: 'loop',
          kind: 'message',
          message: 'Still here.',
          title: 'Loop',
          transitions: [
            {
              actionId: 'loop-again',
              kind: 'navigation',
              label: 'Again',
              targetNodeId: 'loop',
            },
          ],
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['completion_unreachable', 'unreachable_node']),
    );
  });
});
