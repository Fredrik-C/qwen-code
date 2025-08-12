/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Task status states
 */
export enum TaskStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

/**
 * Task dependency relationship types
 */
export enum DependencyType {
  FINISH_TO_START = 'finish_to_start',
  START_TO_START = 'start_to_start',
  FINISH_TO_FINISH = 'finish_to_finish',
  START_TO_FINISH = 'start_to_finish',
}

/**
 * Task dependency definition
 */
export interface TaskDependency {
  /** Dependent task ID */
  taskId: string;
  /** Dependency type */
  type: DependencyType;
  /** Optional delay in minutes */
  delay?: number;
  /** Dependency description */
  description?: string;
}

/**
 * Task acceptance criteria
 */
export interface AcceptanceCriteria {
  /** Criteria identifier */
  id: string;
  /** Criteria description */
  description: string;
  /** Whether criteria is met */
  isMet: boolean;
  /** Verification method */
  verificationMethod?: string;
  /** Verification notes */
  verificationNotes?: string;
  /** Verification timestamp */
  verifiedAt?: Date;
}

/**
 * Task estimation information
 */
export interface TaskEstimation {
  /** Estimated effort in hours */
  effortHours?: number;
  /** Estimated duration in hours */
  durationHours?: number;
  /** Confidence level (0-1) */
  confidence?: number;
  /** Estimation method used */
  method?: string;
  /** Estimation notes */
  notes?: string;
}

/**
 * Task progress tracking
 */
export interface TaskProgress {
  /** Completion percentage (0-100) */
  completionPercentage: number;
  /** Progress description */
  description?: string;
  /** Last update timestamp */
  lastUpdated: Date;
  /** Progress milestones */
  milestones?: TaskMilestone[];
}

/**
 * Task milestone
 */
export interface TaskMilestone {
  /** Milestone identifier */
  id: string;
  /** Milestone name */
  name: string;
  /** Milestone description */
  description?: string;
  /** Whether milestone is completed */
  isCompleted: boolean;
  /** Completion timestamp */
  completedAt?: Date;
  /** Milestone weight (for progress calculation) */
  weight?: number;
}

/**
 * Core task definition
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Task name/title */
  name: string;
  /** Detailed task description */
  description: string;
  /** Task status */
  status: TaskStatus;
  /** Task priority */
  priority: TaskPriority;
  /** Parent orchestration ID */
  orchestrationId: string;
  /** Parent task ID (for subtasks) */
  parentTaskId?: string;
  /** Child task IDs */
  childTaskIds?: string[];
  /** Task dependencies */
  dependencies: TaskDependency[];
  /** Acceptance criteria */
  acceptanceCriteria: AcceptanceCriteria[];
  /** Task estimation */
  estimation?: TaskEstimation;
  /** Task progress */
  progress: TaskProgress;
  /** Associated session ID */
  sessionId?: string;
  /** Task creation timestamp */
  createdAt: Date;
  /** Task start timestamp */
  startedAt?: Date;
  /** Task completion timestamp */
  completedAt?: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Task assignee */
  assignee?: string;
  /** Task tags */
  tags?: string[];
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task creation parameters
 */
export interface CreateTaskParams {
  /** Task name */
  name: string;
  /** Task description */
  description: string;
  /** Task priority */
  priority?: TaskPriority;
  /** Parent orchestration ID */
  orchestrationId: string;
  /** Parent task ID */
  parentTaskId?: string;
  /** Task dependencies */
  dependencies?: TaskDependency[];
  /** Acceptance criteria */
  acceptanceCriteria?: Omit<AcceptanceCriteria, 'id' | 'isMet'>[];
  /** Task estimation */
  estimation?: TaskEstimation;
  /** Task assignee */
  assignee?: string;
  /** Task tags */
  tags?: string[];
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task update parameters
 */
export interface UpdateTaskParams {
  /** Updated task name */
  name?: string;
  /** Updated task description */
  description?: string;
  /** Updated task status */
  status?: TaskStatus;
  /** Updated task priority */
  priority?: TaskPriority;
  /** Updated dependencies */
  dependencies?: TaskDependency[];
  /** Updated acceptance criteria */
  acceptanceCriteria?: AcceptanceCriteria[];
  /** Updated estimation */
  estimation?: TaskEstimation;
  /** Updated progress */
  progress?: Partial<TaskProgress>;
  /** Associated session ID */
  sessionId?: string;
  /** Updated assignee */
  assignee?: string;
  /** Updated tags */
  tags?: string[];
  /** Updated metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task query parameters for filtering
 */
export interface TaskQuery {
  /** Filter by orchestration ID */
  orchestrationId?: string;
  /** Filter by task status */
  status?: TaskStatus;
  /** Filter by task priority */
  priority?: TaskPriority;
  /** Filter by parent task ID */
  parentTaskId?: string;
  /** Filter by assignee */
  assignee?: string;
  /** Filter by tags */
  tags?: string[];
  /** Filter by date range */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  /** Include subtasks */
  includeSubtasks?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}
