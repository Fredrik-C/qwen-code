/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, TaskPriority } from './task.js';

/**
 * Planning phase states
 */
export enum PlanningPhase {
  REQUIREMENTS_ANALYSIS = 'requirements_analysis',
  ARCHITECTURE_DESIGN = 'architecture_design',
  TASK_DECOMPOSITION = 'task_decomposition',
  VALIDATION = 'validation',
  APPROVAL = 'approval',
  COMPLETED = 'completed',
}

/**
 * Plan status
 */
export enum PlanStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Requirement definition
 */
export interface Requirement {
  /** Unique requirement identifier */
  id: string;
  /** Requirement title */
  title: string;
  /** Detailed requirement description */
  description: string;
  /** Requirement type */
  type: 'functional' | 'non_functional' | 'constraint' | 'assumption';
  /** Requirement priority */
  priority: TaskPriority;
  /** Requirement source */
  source?: string;
  /** Acceptance criteria */
  acceptanceCriteria?: string[];
  /** Related requirements */
  relatedRequirements?: string[];
  /** Requirement status */
  status: 'identified' | 'analyzed' | 'approved' | 'implemented' | 'verified';
  /** Requirement metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Architecture decision
 */
export interface ArchitectureDecision {
  /** Decision identifier */
  id: string;
  /** Decision title */
  title: string;
  /** Decision description */
  description: string;
  /** Decision rationale */
  rationale: string;
  /** Decision alternatives considered */
  alternatives?: string[];
  /** Decision consequences */
  consequences?: string[];
  /** Decision status */
  status: 'proposed' | 'accepted' | 'rejected' | 'superseded';
  /** Decision date */
  date: Date;
  /** Decision metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Development phase definition
 */
export interface DevelopmentPhase {
  /** Phase identifier */
  id: string;
  /** Phase name */
  name: string;
  /** Phase description */
  description: string;
  /** Phase order/sequence */
  order: number;
  /** Phase tasks */
  taskIds: string[];
  /** Phase dependencies */
  dependencies?: string[];
  /** Phase estimation */
  estimation?: {
    effortHours?: number;
    durationHours?: number;
    confidence?: number;
  };
  /** Phase status */
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  /** Phase metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Risk assessment
 */
export interface RiskAssessment {
  /** Risk identifier */
  id: string;
  /** Risk description */
  description: string;
  /** Risk category */
  category: 'technical' | 'schedule' | 'resource' | 'external' | 'quality';
  /** Risk probability (0-1) */
  probability: number;
  /** Risk impact (0-1) */
  impact: number;
  /** Risk score (probability * impact) */
  score: number;
  /** Mitigation strategies */
  mitigationStrategies?: string[];
  /** Risk status */
  status: 'identified' | 'assessed' | 'mitigated' | 'accepted' | 'occurred';
  /** Risk metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Quality gate definition
 */
export interface QualityGate {
  /** Gate identifier */
  id: string;
  /** Gate name */
  name: string;
  /** Gate description */
  description: string;
  /** Gate criteria */
  criteria: QualityGateCriteria[];
  /** Gate phase */
  phase: string;
  /** Gate status */
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  /** Gate metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Quality gate criteria
 */
export interface QualityGateCriteria {
  /** Criteria identifier */
  id: string;
  /** Criteria description */
  description: string;
  /** Criteria type */
  type: 'test_coverage' | 'code_quality' | 'performance' | 'security' | 'documentation';
  /** Criteria threshold */
  threshold?: number;
  /** Criteria measurement */
  measurement?: number;
  /** Criteria status */
  status: 'pending' | 'passed' | 'failed';
  /** Criteria metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Development plan
 */
export interface DevelopmentPlan {
  /** Plan identifier */
  id: string;
  /** Plan name */
  name: string;
  /** Plan description */
  description: string;
  /** Plan status */
  status: PlanStatus;
  /** Planning phase */
  currentPhase: PlanningPhase;
  /** Plan requirements */
  requirements: Requirement[];
  /** Architecture decisions */
  architectureDecisions: ArchitectureDecision[];
  /** Development phases */
  phases: DevelopmentPhase[];
  /** Plan tasks */
  tasks: Task[];
  /** Risk assessments */
  risks: RiskAssessment[];
  /** Quality gates */
  qualityGates: QualityGate[];
  /** Plan estimation */
  estimation?: {
    totalEffortHours?: number;
    totalDurationHours?: number;
    confidence?: number;
  };
  /** Plan creation timestamp */
  createdAt: Date;
  /** Plan approval timestamp */
  approvedAt?: Date;
  /** Plan completion timestamp */
  completedAt?: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Plan metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Plan creation parameters
 */
export interface CreatePlanParams {
  /** Plan name */
  name: string;
  /** Plan description */
  description: string;
  /** Initial requirements */
  requirements?: Omit<Requirement, 'id'>[];
  /** Initial architecture decisions */
  architectureDecisions?: Omit<ArchitectureDecision, 'id'>[];
  /** Plan metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Plan update parameters
 */
export interface UpdatePlanParams {
  /** Updated plan name */
  name?: string;
  /** Updated plan description */
  description?: string;
  /** Updated plan status */
  status?: PlanStatus;
  /** Updated planning phase */
  currentPhase?: PlanningPhase;
  /** Updated requirements */
  requirements?: Requirement[];
  /** Updated architecture decisions */
  architectureDecisions?: ArchitectureDecision[];
  /** Updated phases */
  phases?: DevelopmentPhase[];
  /** Updated risks */
  risks?: RiskAssessment[];
  /** Updated quality gates */
  qualityGates?: QualityGate[];
  /** Updated estimation */
  estimation?: {
    totalEffortHours?: number;
    totalDurationHours?: number;
    confidence?: number;
  };
  /** Updated metadata */
  metadata?: Record<string, unknown>;
}
