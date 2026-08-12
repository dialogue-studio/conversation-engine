/**
 * A learning outcome that a scenario can require before it is fully completed.
 * Authors work with its title in the editor; IDs remain stable when titles change.
 */
export interface ScenarioObjective {
  readonly id: string;
  readonly required: boolean;
  readonly title: string;
}

export type ScenarioNodeKind = 'completion' | 'message';

export type TransitionKind = 'choice' | 'finish' | 'hint' | 'navigation';

/**
 * Platform-neutral layout hint for a node's available actions.
 * Platforms may use fewer columns when their own limits require it.
 */
export interface ButtonLayout {
  readonly columns: number;
}

/**
 * The authoring format for a node's primary text. Adapters compile this source
 * format to the dialect supported by their platform (for example Telegram
 * MarkdownV2), rather than passing raw authored markdown through unchanged.
 */
export type MessageFormat = 'markdown' | 'plain';

/** A stable reference to an asset managed by Dialogue Studio. */
export interface ManagedAssetSource {
  readonly assetId: string;
  readonly kind: 'asset';
}

/** A publicly retrievable file URL, useful before an asset is imported. */
export interface ExternalUrlSource {
  readonly kind: 'external_url';
  readonly url: string;
}

export type AttachmentSource = ExternalUrlSource | ManagedAssetSource;

export type MediaAttachmentKind =
  'animation' | 'audio' | 'document' | 'photo' | 'video' | 'voice';

/** A media asset, including GIFs represented as `animation`. */
export interface MediaAttachment {
  readonly caption?: string;
  readonly kind: MediaAttachmentKind;
  readonly source: AttachmentSource;
}

/** A standalone link that a platform may render as a button or preview. */
export interface LinkAttachment {
  readonly kind: 'link';
  readonly label?: string;
  readonly url: string;
}

/** Native contact data, not a string that needs to be parsed from markdown. */
export interface ContactAttachment {
  readonly firstName: string;
  readonly kind: 'contact';
  readonly lastName?: string;
  readonly phoneNumber: string;
}

/** A point that platforms can render as their native map/location message. */
export interface LocationAttachment {
  readonly address?: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly kind: 'location';
  readonly title?: string;
}

/**
 * Extra outgoing content for a node. The node's `message` remains the primary
 * text, so existing plain-text scenarios remain valid without migration.
 */
export type ScenarioAttachment =
  ContactAttachment | LinkAttachment | LocationAttachment | MediaAttachment;

/**
 * Conditions that control whether a transition is offered to a participant.
 * All listed objectives must have been completed for the transition to unlock.
 */
export interface TransitionAvailability {
  readonly requiresCompletedObjectiveIds?: readonly string[];
}

/** Controls whether a previously answered route remains visible to a participant. */
export interface TransitionVisibility {
  /**
   * Remove this action from the current session once its target node has been
   * visited. Stateful runtimes also reject a later direct selection of it.
   */
  readonly hideWhenTargetVisited?: boolean;
}

export interface Transition
  extends TransitionAvailability, TransitionVisibility {
  /**
   * Stable, scenario-wide unique action identifier. It is safe to persist in
   * participant progress, including for hint usage.
   */
  readonly actionId: string;
  /**
   * Completion is determined by the target node. A `finish` transition must
   * target a completion node; the runtime rejects the inverse mismatch.
   *
   * A `hint` transition points to a regular message node that contains the hint
   * content and any available follow-up actions. Hint text never lives on the
   * transition itself.
   */
  readonly kind: TransitionKind;
  readonly label: string;
  readonly targetNodeId: string;
}

export interface ScenarioNode {
  readonly attachments?: readonly ScenarioAttachment[];
  readonly buttonLayout?: ButtonLayout;
  readonly completesObjectiveIds: readonly string[];
  readonly id: string;
  readonly kind: ScenarioNodeKind;
  readonly message: string;
  readonly messageFormat?: MessageFormat;
  readonly speaker?: string;
  readonly title: string;
  readonly transitions: readonly Transition[];
}

export interface Scenario {
  readonly description?: string;
  readonly id: string;
  readonly initialNodeId: string;
  readonly nodes: Readonly<Record<string, ScenarioNode>>;
  readonly objectives: readonly ScenarioObjective[];
  readonly schemaVersion: 1;
  readonly title: string;
  /** Immutable content version chosen by a project when it is published. */
  readonly version: number;
}

export type {
  ScenarioValidationIssue,
  ScenarioValidationResult,
} from './validator.js';
export { validateScenario } from './validator.js';
