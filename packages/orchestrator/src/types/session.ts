/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content } from '@google/genai';

/**
 * Types of orchestration sessions
 */
export enum SessionType {
  PLANNING = 'planning',
  TASK = 'task',
  VERIFICATION = 'verification',
  INTERACTIVE = 'interactive',
}

/**
 * Session lifecycle states
 */
export enum SessionState {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  SUSPENDED = 'suspended',
  FAILED = 'failed',
}

/**
 * Session metadata for tracking and organization
 */
export interface SessionMetadata {
  /** Human-readable session name */
  name?: string;
  /** Session description */
  description?: string;
  /** Tags for categorization */
  tags?: string[];
  /** User-defined metadata */
  userMetadata?: Record<string, unknown>;
}

/**
 * Decision made during a session
 */
export interface SessionDecision {
  /** Unique decision identifier */
  id: string;
  /** Timestamp when decision was made */
  timestamp: Date;
  /** Decision description */
  description: string;
  /** Decision rationale */
  rationale?: string;
  /** Decision outcome or result */
  outcome?: string;
  /** Related artifacts */
  artifacts?: string[];
}

/**
 * Artifact created or modified during a session
 */
export interface SessionArtifact {
  /** Unique artifact identifier */
  id: string;
  /** Artifact type (file, plan, task, etc.) */
  type: string;
  /** Artifact name or title */
  name: string;
  /** File path if applicable */
  path?: string;
  /** Artifact content or reference */
  content?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modification timestamp */
  modifiedAt: Date;
  /** Related session decisions */
  relatedDecisions?: string[];
}

/**
 * Sequential thinking session data
 */
export interface ThinkingSession {
  /** Thinking session identifier */
  id: string;
  /** Thinking steps */
  steps: ThinkingStep[];
  /** Current step index */
  currentStep: number;
  /** Total estimated steps */
  totalSteps: number;
  /** Thinking session state */
  state: 'active' | 'completed' | 'paused';
  /** Thinking session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Individual thinking step
 */
export interface ThinkingStep {
  /** Step number */
  stepNumber: number;
  /** Current thought */
  thought: string;
  /** Whether next thought is needed */
  nextThoughtNeeded: boolean;
  /** Whether this is a revision */
  isRevision?: boolean;
  /** Which thought is being revised */
  revisesThought?: number;
  /** Branch information */
  branchFromThought?: number;
  /** Branch identifier */
  branchId?: string;
  /** Whether more thoughts are needed */
  needsMoreThoughts?: boolean;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Session context containing conversation and state
 */
export interface SessionContext {
  /** Conversation messages */
  messages: Content[];
  /** Session artifacts */
  artifacts: SessionArtifact[];
  /** Session decisions */
  decisions: SessionDecision[];
  /** Current focus or objective */
  currentFocus: string;
  /** Sequential thinking session if active */
  sequentialThinking?: ThinkingSession;
  /** Session-specific variables */
  variables?: Record<string, unknown>;
}

/**
 * Core orchestration session interface
 */
export interface OrchestrationSession {
  /** Unique session identifier */
  id: string;
  /** Session type */
  type: SessionType;
  /** Parent orchestration identifier */
  orchestrationId: string;
  /** Associated task identifier (for task sessions) */
  taskId?: string;
  /** Session creation timestamp */
  timestamp: Date;
  /** Session context */
  context: SessionContext;
  /** Session state */
  state: SessionState;
  /** Session metadata */
  metadata: SessionMetadata;
  /** Parent session identifier */
  parentSessionId?: string;
  /** Child session identifiers */
  childSessionIds?: string[];
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Session completion timestamp */
  completedAt?: Date;
  /** Session failure reason */
  failureReason?: string;
}

/**
 * Session creation parameters
 */
export interface CreateSessionParams {
  /** Session type */
  type: SessionType;
  /** Parent orchestration identifier */
  orchestrationId: string;
  /** Associated task identifier (optional) */
  taskId?: string;
  /** Initial focus or objective */
  initialFocus?: string;
  /** Session context */
  context?: Partial<SessionContext>;
  /** Session metadata */
  metadata?: SessionMetadata;
  /** Parent session identifier */
  parentSessionId?: string;
  /** Initial context variables */
  initialVariables?: Record<string, unknown>;
}

/**
 * Session update parameters
 */
export interface UpdateSessionParams {
  /** New session state */
  state?: SessionState;
  /** Updated focus */
  currentFocus?: string;
  /** Session context updates */
  context?: Partial<SessionContext>;
  /** Additional metadata */
  metadata?: Partial<SessionMetadata>;
  /** Failure reason (if state is FAILED) */
  failureReason?: string;
  /** Session variables to update */
  variables?: Record<string, unknown>;
}

/**
 * Session query parameters for filtering
 */
export interface SessionQuery {
  /** Filter by orchestration ID */
  orchestrationId?: string;
  /** Filter by session type */
  type?: SessionType;
  /** Filter by session state */
  state?: SessionState;
  /** Filter by task ID */
  taskId?: string;
  /** Filter by parent session ID */
  parentSessionId?: string;
  /** Filter by date range */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  /** Filter by tags */
  tags?: string[];
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}
