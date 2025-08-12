/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Verification status
 */
export enum VerificationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  BLOCKED = 'blocked',
}

/**
 * Verification type
 */
export enum VerificationType {
  UNIT_TEST = 'unit_test',
  INTEGRATION_TEST = 'integration_test',
  SYSTEM_TEST = 'system_test',
  ACCEPTANCE_TEST = 'acceptance_test',
  PERFORMANCE_TEST = 'performance_test',
  SECURITY_TEST = 'security_test',
  CODE_REVIEW = 'code_review',
  MANUAL_VERIFICATION = 'manual_verification',
  AUTOMATED_VERIFICATION = 'automated_verification',
}

/**
 * Verification severity level
 */
export enum VerificationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Verification issue
 */
export interface VerificationIssue {
  /** Issue identifier */
  id: string;
  /** Issue title */
  title: string;
  /** Issue description */
  description: string;
  /** Issue severity */
  severity: VerificationSeverity;
  /** Issue type */
  type: string;
  /** File path if applicable */
  filePath?: string;
  /** Line number if applicable */
  lineNumber?: number;
  /** Issue resolution */
  resolution?: string;
  /** Issue status */
  status: 'open' | 'resolved' | 'ignored';
  /** Issue metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Test result
 */
export interface TestResult {
  /** Test identifier */
  id: string;
  /** Test name */
  name: string;
  /** Test description */
  description?: string;
  /** Test status */
  status: VerificationStatus;
  /** Test duration in milliseconds */
  duration?: number;
  /** Test output */
  output?: string;
  /** Test error message */
  errorMessage?: string;
  /** Test stack trace */
  stackTrace?: string;
  /** Test metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Verification check
 */
export interface VerificationCheck {
  /** Check identifier */
  id: string;
  /** Check name */
  name: string;
  /** Check description */
  description: string;
  /** Check type */
  type: VerificationType;
  /** Check status */
  status: VerificationStatus;
  /** Check command or script */
  command?: string;
  /** Check timeout in seconds */
  timeout?: number;
  /** Check retry count */
  retryCount?: number;
  /** Check results */
  results?: TestResult[];
  /** Check issues */
  issues?: VerificationIssue[];
  /** Check start timestamp */
  startedAt?: Date;
  /** Check completion timestamp */
  completedAt?: Date;
  /** Check duration in milliseconds */
  duration?: number;
  /** Check metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Completion criteria
 */
export interface CompletionCriteria {
  /** Criteria identifier */
  id: string;
  /** Criteria name */
  name: string;
  /** Criteria description */
  description: string;
  /** Criteria type */
  type: 'task_completion' | 'quality_gate' | 'test_coverage' | 'code_quality' | 'custom';
  /** Criteria threshold */
  threshold?: number;
  /** Current measurement */
  currentValue?: number;
  /** Criteria status */
  status: VerificationStatus;
  /** Criteria weight for overall completion */
  weight?: number;
  /** Criteria metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Verification report
 */
export interface VerificationReport {
  /** Report identifier */
  id: string;
  /** Report name */
  name: string;
  /** Report description */
  description?: string;
  /** Orchestration ID */
  orchestrationId: string;
  /** Overall verification status */
  overallStatus: VerificationStatus;
  /** Verification checks */
  checks: VerificationCheck[];
  /** Completion criteria */
  completionCriteria: CompletionCriteria[];
  /** Overall completion percentage */
  completionPercentage: number;
  /** Quality score (0-100) */
  qualityScore?: number;
  /** Verification issues */
  issues: VerificationIssue[];
  /** Resumption recommendations */
  resumptionRecommendations?: ResumptionRecommendation[];
  /** Report generation timestamp */
  generatedAt: Date;
  /** Report metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Resumption recommendation
 */
export interface ResumptionRecommendation {
  /** Recommendation identifier */
  id: string;
  /** Recommendation type */
  type: 'resume_planning' | 'resume_task' | 'resume_verification' | 'create_new_task';
  /** Recommendation description */
  description: string;
  /** Recommendation priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Target session ID */
  targetSessionId?: string;
  /** Target task ID */
  targetTaskId?: string;
  /** Recommendation actions */
  actions?: string[];
  /** Recommendation metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Verification configuration
 */
export interface VerificationConfig {
  /** Enabled verification types */
  enabledTypes: VerificationType[];
  /** Test command patterns */
  testCommands?: Record<string, string>;
  /** Quality thresholds */
  qualityThresholds?: Record<string, number>;
  /** Timeout settings */
  timeouts?: Record<string, number>;
  /** Retry settings */
  retrySettings?: Record<string, number>;
  /** Custom verification scripts */
  customScripts?: Record<string, string>;
  /** Verification metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Verification creation parameters
 */
export interface CreateVerificationParams {
  /** Report name */
  name: string;
  /** Report description */
  description?: string;
  /** Orchestration ID */
  orchestrationId: string;
  /** Verification checks to run */
  checks?: Omit<VerificationCheck, 'id' | 'status' | 'results' | 'issues'>[];
  /** Completion criteria */
  completionCriteria?: Omit<CompletionCriteria, 'id' | 'status' | 'currentValue'>[];
  /** Verification configuration */
  config?: VerificationConfig;
  /** Report metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Verification update parameters
 */
export interface UpdateVerificationParams {
  /** Updated report name */
  name?: string;
  /** Updated report description */
  description?: string;
  /** Updated overall status */
  overallStatus?: VerificationStatus;
  /** Updated checks */
  checks?: VerificationCheck[];
  /** Updated completion criteria */
  completionCriteria?: CompletionCriteria[];
  /** Updated completion percentage */
  completionPercentage?: number;
  /** Updated quality score */
  qualityScore?: number;
  /** Updated issues */
  issues?: VerificationIssue[];
  /** Updated resumption recommendations */
  resumptionRecommendations?: ResumptionRecommendation[];
  /** Updated metadata */
  metadata?: Record<string, unknown>;
}
