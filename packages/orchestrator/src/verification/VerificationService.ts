/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  VerificationReport, 
  VerificationCheck, 
  VerificationStatus, 
  VerificationType,
  CompletionCriteria,
  VerificationIssue,
  ResumptionRecommendation,
  CreateVerificationParams 
} from '../types/verification.js';
import { Task, TaskStatus } from '../types/task.js';
import { SessionRegistry } from '../session/SessionRegistry.js';
import { TaskManifest } from '../state/TaskManifest.js';
import { ContextLoader } from '../session/ContextLoader.js';

/**
 * Verification options
 */
export interface VerificationOptions {
  detailed: boolean;
  skipTests: boolean;
  generateReport: boolean;
  verificationSessionId?: string;
}

/**
 * Verification result
 */
export interface VerificationResult {
  success: boolean;
  report?: VerificationReport;
  taskSummary?: Array<{
    id: string;
    name: string;
    status: TaskStatus;
    completionPercentage: number;
  }>;
  errors: string[];
  warnings: string[];
  nextSteps: string[];
  reportPath?: string;
}

/**
 * Verification service for project completion assessment
 */
export class VerificationService {
  private sessionRegistry: SessionRegistry;
  private taskManifest: TaskManifest;
  private contextLoader: ContextLoader;

  constructor(
    sessionRegistry: SessionRegistry,
    taskManifest: TaskManifest,
    contextLoader: ContextLoader
  ) {
    this.sessionRegistry = sessionRegistry;
    this.taskManifest = taskManifest;
    this.contextLoader = contextLoader;
  }

  /**
   * Perform comprehensive completion verification
   */
  async performCompletionVerification(
    orchestrationId: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    const result: VerificationResult = {
      success: false,
      errors: [],
      warnings: [],
      nextSteps: [],
    };

    try {
      // Load all tasks for the orchestration
      const tasks = await this.taskManifest.queryTasks({ orchestrationId });
      
      if (tasks.length === 0) {
        result.errors.push('No tasks found for orchestration');
        return result;
      }

      // Create verification report
      const report = await this.createVerificationReport(orchestrationId, tasks, options);
      result.report = report;

      // Create task summary
      result.taskSummary = tasks.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        completionPercentage: task.progress.completionPercentage,
      }));

      // Perform verification checks
      await this.performVerificationChecks(report, tasks, options);

      // Assess completion criteria
      await this.assessCompletionCriteria(report, tasks);

      // Generate issues and recommendations
      await this.generateIssuesAndRecommendations(report, tasks);

      // Calculate overall completion
      this.calculateOverallCompletion(report, tasks);

      // Generate report file if requested
      if (options.generateReport) {
        result.reportPath = await this.generateReportFile(report, orchestrationId);
      }

      // Determine next steps
      result.nextSteps = this.determineNextSteps(report, tasks);

      result.success = true;

    } catch (error) {
      result.errors.push(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Create verification report structure
   */
  private async createVerificationReport(
    orchestrationId: string,
    tasks: Task[],
    options: VerificationOptions
  ): Promise<VerificationReport> {
    const report: VerificationReport = {
      id: `verification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'Project Completion Verification',
      description: 'Comprehensive assessment of project completion status',
      orchestrationId,
      overallStatus: VerificationStatus.PENDING,
      checks: [],
      completionCriteria: [],
      completionPercentage: 0,
      issues: [],
      resumptionRecommendations: [],
      generatedAt: new Date(),
      metadata: {
        verificationMode: options.detailed ? 'detailed' : 'standard',
        skipTests: options.skipTests,
        taskCount: tasks.length,
      },
    };

    return report;
  }

  /**
   * Perform verification checks
   */
  private async performVerificationChecks(
    report: VerificationReport,
    tasks: Task[],
    options: VerificationOptions
  ): Promise<void> {
    // Task completion check
    const taskCompletionCheck: VerificationCheck = {
      id: 'task-completion',
      name: 'Task Completion',
      description: 'Verify all tasks are completed',
      type: VerificationType.MANUAL_VERIFICATION,
      status: VerificationStatus.PENDING,
      results: [],
      issues: [],
      metadata: {},
    };

    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);
    taskCompletionCheck.status = completedTasks.length === tasks.length ? 
      VerificationStatus.PASSED : VerificationStatus.FAILED;

    if (taskCompletionCheck.status === VerificationStatus.FAILED) {
      const incompleteTasks = tasks.filter(t => t.status !== TaskStatus.COMPLETED);
      taskCompletionCheck.issues = incompleteTasks.map(task => ({
        id: `incomplete-${task.id}`,
        title: `Task not completed: ${task.name}`,
        description: `Task "${task.name}" has status: ${task.status}`,
        severity: 'high' as any,
        type: 'task_incomplete',
        status: 'open' as any,
      }));
    }

    report.checks.push(taskCompletionCheck);

    // Acceptance criteria check
    const acceptanceCriteriaCheck: VerificationCheck = {
      id: 'acceptance-criteria',
      name: 'Acceptance Criteria',
      description: 'Verify all acceptance criteria are met',
      type: VerificationType.MANUAL_VERIFICATION,
      status: VerificationStatus.PENDING,
      results: [],
      issues: [],
      metadata: {},
    };

    let totalCriteria = 0;
    let metCriteria = 0;

    for (const task of tasks) {
      totalCriteria += task.acceptanceCriteria.length;
      metCriteria += task.acceptanceCriteria.filter(c => c.isMet).length;
    }

    acceptanceCriteriaCheck.status = totalCriteria > 0 && metCriteria === totalCriteria ? 
      VerificationStatus.PASSED : 
      totalCriteria === 0 ? VerificationStatus.SKIPPED : VerificationStatus.FAILED;

    if (acceptanceCriteriaCheck.status === VerificationStatus.FAILED) {
      for (const task of tasks) {
        const unmetCriteria = task.acceptanceCriteria.filter(c => !c.isMet);
        for (const criteria of unmetCriteria) {
          acceptanceCriteriaCheck.issues!.push({
            id: `unmet-${criteria.id}`,
            title: `Unmet acceptance criteria: ${criteria.description}`,
            description: `Task "${task.name}" has unmet criteria: ${criteria.description}`,
            severity: 'medium' as any,
            type: 'acceptance_criteria',
            status: 'open' as any,
          });
        }
      }
    }

    report.checks.push(acceptanceCriteriaCheck);

    // Quality check (simplified)
    const qualityCheck: VerificationCheck = {
      id: 'quality-assessment',
      name: 'Quality Assessment',
      description: 'Assess overall project quality',
      type: VerificationType.CODE_REVIEW,
      status: VerificationStatus.PENDING,
      results: [],
      issues: [],
      metadata: {},
    };

    // Simple quality assessment based on task completion and criteria
    const qualityScore = totalCriteria > 0 ? (metCriteria / totalCriteria) * 100 : 0;
    report.qualityScore = Math.round(qualityScore);

    qualityCheck.status = qualityScore >= 80 ? VerificationStatus.PASSED :
                         qualityScore >= 60 ? VerificationStatus.FAILED : VerificationStatus.FAILED;

    report.checks.push(qualityCheck);

    // Test execution check (if not skipped)
    if (!options.skipTests) {
      const testCheck: VerificationCheck = {
        id: 'test-execution',
        name: 'Test Execution',
        description: 'Run automated tests',
        type: VerificationType.AUTOMATED_VERIFICATION,
        status: VerificationStatus.SKIPPED,
        results: [],
        issues: [],
        metadata: { reason: 'Test execution not implemented yet' },
      };

      report.checks.push(testCheck);
    }
  }

  /**
   * Assess completion criteria
   */
  private async assessCompletionCriteria(
    report: VerificationReport,
    tasks: Task[]
  ): Promise<void> {
    // Task completion criteria
    const taskCompletionCriteria: CompletionCriteria = {
      id: 'task-completion-criteria',
      name: 'All Tasks Completed',
      description: 'All planned tasks must be completed',
      type: 'task_completion',
      threshold: 100,
      currentValue: (tasks.filter(t => t.status === TaskStatus.COMPLETED).length / tasks.length) * 100,
      status: VerificationStatus.PENDING,
      weight: 0.6,
    };

    taskCompletionCriteria.status = (
      taskCompletionCriteria.currentValue !== undefined &&
      taskCompletionCriteria.threshold !== undefined &&
      taskCompletionCriteria.currentValue >= taskCompletionCriteria.threshold
    ) ? VerificationStatus.PASSED : VerificationStatus.FAILED;

    report.completionCriteria.push(taskCompletionCriteria);

    // Quality criteria
    const qualityCriteria: CompletionCriteria = {
      id: 'quality-criteria',
      name: 'Quality Standards Met',
      description: 'Project meets quality standards',
      type: 'quality_gate',
      threshold: 80,
      currentValue: report.qualityScore || 0,
      status: VerificationStatus.PENDING,
      weight: 0.4,
    };

    qualityCriteria.status = (
      qualityCriteria.currentValue !== undefined &&
      qualityCriteria.threshold !== undefined &&
      qualityCriteria.currentValue >= qualityCriteria.threshold
    ) ? VerificationStatus.PASSED : VerificationStatus.FAILED;

    report.completionCriteria.push(qualityCriteria);
  }

  /**
   * Generate issues and recommendations
   */
  private async generateIssuesAndRecommendations(
    report: VerificationReport,
    tasks: Task[]
  ): Promise<void> {
    // Collect issues from checks
    for (const check of report.checks) {
      if (check.issues) {
        report.issues.push(...check.issues);
      }
    }

    // Generate recommendations based on status
    const incompleteTasks = tasks.filter(t => t.status !== TaskStatus.COMPLETED);
    const blockedTasks = tasks.filter(t => t.status === TaskStatus.BLOCKED);
    const failedTasks = tasks.filter(t => t.status === TaskStatus.FAILED);

    // Initialize resumption recommendations if not already present
    if (!report.resumptionRecommendations) {
      report.resumptionRecommendations = [];
    }

    if (incompleteTasks.length > 0) {
      report.resumptionRecommendations.push({
        id: 'complete-tasks',
        type: 'resume_task',
        description: `Complete ${incompleteTasks.length} remaining tasks`,
        priority: 'high',
        actions: incompleteTasks.map(t => `Complete task: ${t.name}`),
      });
    }

    if (blockedTasks.length > 0) {
      report.resumptionRecommendations.push({
        id: 'unblock-tasks',
        type: 'resume_task',
        description: `Unblock ${blockedTasks.length} blocked tasks`,
        priority: 'critical',
        actions: blockedTasks.map(t => `Resolve blockers for: ${t.name}`),
      });
    }

    if (failedTasks.length > 0) {
      report.resumptionRecommendations.push({
        id: 'retry-failed',
        type: 'resume_task',
        description: `Retry ${failedTasks.length} failed tasks`,
        priority: 'high',
        actions: failedTasks.map(t => `Retry task: ${t.name}`),
      });
    }

    if (report.qualityScore && report.qualityScore < 80) {
      report.resumptionRecommendations.push({
        id: 'improve-quality',
        type: 'resume_verification',
        description: 'Improve project quality to meet standards',
        priority: 'medium',
        actions: ['Review and improve code quality', 'Add missing tests', 'Complete acceptance criteria'],
      });
    }
  }

  /**
   * Calculate overall completion
   */
  private calculateOverallCompletion(report: VerificationReport, tasks: Task[]): void {
    // Calculate weighted completion based on criteria
    let totalWeight = 0;
    let weightedScore = 0;

    for (const criteria of report.completionCriteria) {
      const weight = criteria.weight || 1;
      totalWeight += weight;
      
      if (criteria.currentValue !== undefined && criteria.threshold) {
        const score = Math.min(criteria.currentValue / criteria.threshold, 1) * 100;
        weightedScore += score * weight;
      }
    }

    report.completionPercentage = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    // Determine overall status
    if (report.completionPercentage >= 100 && report.checks.every(c => c.status === VerificationStatus.PASSED)) {
      report.overallStatus = VerificationStatus.PASSED;
    } else if (report.checks.some(c => c.status === VerificationStatus.FAILED)) {
      report.overallStatus = VerificationStatus.FAILED;
    } else {
      report.overallStatus = VerificationStatus.IN_PROGRESS;
    }
  }

  /**
   * Generate report file
   */
  private async generateReportFile(report: VerificationReport, orchestrationId: string): Promise<string> {
    const reportDir = path.join('.qwen', 'orchestration', 'reports');
    await fs.mkdir(reportDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `completion-report-${orchestrationId}-${timestamp}.json`);
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    
    return reportPath;
  }

  /**
   * Determine next steps based on verification results
   */
  private determineNextSteps(report: VerificationReport, tasks: Task[]): string[] {
    const nextSteps: string[] = [];

    if (report.overallStatus === VerificationStatus.PASSED) {
      nextSteps.push('🎉 Project is complete and ready for delivery');
      nextSteps.push('Consider final review and documentation');
    } else {
      const incompleteTasks = tasks.filter(t => t.status !== TaskStatus.COMPLETED);
      
      if (incompleteTasks.length > 0) {
        nextSteps.push(`Complete ${incompleteTasks.length} remaining tasks`);
        nextSteps.push('Use /new_task to continue implementation');
      }

      if (report.issues.length > 0) {
        nextSteps.push(`Address ${report.issues.length} identified issues`);
      }

      if (report.qualityScore && report.qualityScore < 80) {
        nextSteps.push('Improve project quality to meet standards');
      }

      nextSteps.push('Re-run /check_completeness after addressing issues');
    }

    return nextSteps;
  }
}
