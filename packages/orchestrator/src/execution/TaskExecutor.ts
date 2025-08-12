/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Task, 
  TaskStatus, 
  TaskDependency, 
  DependencyType, 
  UpdateTaskParams 
} from '../types/task.js';
import { 
  SessionType, 
  SessionState, 
  CreateSessionParams 
} from '../types/session.js';
import { SessionRegistry } from '../session/SessionRegistry.js';
import { TaskManifest } from '../state/TaskManifest.js';
import { ContextLoader, LoadedContext } from '../session/ContextLoader.js';
import { OrchestrationSession } from '../session/OrchestrationSession.js';

/**
 * Task execution options
 */
export interface TaskExecutionOptions {
  /** Create fresh session for task execution */
  createFreshSession: boolean;
  /** Load planning context for task */
  loadPlanningContext: boolean;
  /** Skip verification phase */
  skipVerification: boolean;
  /** Force execution even if dependencies not met */
  forceExecution: boolean;
  /** Custom session metadata */
  sessionMetadata?: Record<string, unknown>;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  success: boolean;
  taskId: string;
  sessionId?: string;
  verificationSessionId?: string;
  taskStatus: TaskStatus;
  contextLoaded?: {
    planningContext: boolean;
    taskSpecs: boolean;
    dependencies: boolean;
  };
  errors: string[];
  warnings: string[];
  nextSteps: string[];
}

/**
 * Dependency check result
 */
export interface DependencyCheckResult {
  allSatisfied: boolean;
  satisfiedDependencies: TaskDependency[];
  unsatisfiedDependencies: TaskDependency[];
  blockedBy: string[];
}

/**
 * Task executor for implementing orchestration tasks
 */
export class TaskExecutor {
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
   * Execute a task with the specified options
   */
  async executeTask(
    taskId: string,
    options: TaskExecutionOptions
  ): Promise<TaskExecutionResult> {
    const result: TaskExecutionResult = {
      success: false,
      taskId,
      taskStatus: TaskStatus.NOT_STARTED,
      errors: [],
      warnings: [],
      nextSteps: [],
    };

    try {
      // Load the task
      const task = await this.taskManifest.loadTask(taskId);
      if (!task) {
        result.errors.push(`Task ${taskId} not found`);
        return result;
      }

      result.taskStatus = task.status;

      // Check dependencies if not forcing
      if (!options.forceExecution) {
        const dependencyCheck = await this.checkDependencies(taskId);
        if (!dependencyCheck.allSatisfied) {
          result.errors.push('Task dependencies not satisfied');
          result.errors.push(...dependencyCheck.blockedBy);
          return result;
        }
      }

      // Create task execution session
      if (options.createFreshSession) {
        const session = await this.createTaskSession(task, options);
        result.sessionId = session.id;

        // Load context for the session
        if (options.loadPlanningContext) {
          const contextResult = await this.loadTaskContext(session, task);
          result.contextLoaded = contextResult;
        }
      }

      // Update task status to in progress
      await this.taskManifest.updateTask(taskId, {
        status: TaskStatus.IN_PROGRESS,
        sessionId: result.sessionId,
      });

      result.taskStatus = TaskStatus.IN_PROGRESS;

      // Create verification session if not skipping
      if (!options.skipVerification) {
        const verificationSession = await this.createVerificationSession(task);
        result.verificationSessionId = verificationSession.id;
      }

      result.success = true;
      result.nextSteps.push('Task implementation session created');
      result.nextSteps.push('Begin implementing the task requirements');
      
      if (!options.skipVerification) {
        result.nextSteps.push('Verification session will run after implementation');
      }

    } catch (error) {
      result.errors.push(`Task execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Check task dependencies
   */
  async checkDependencies(taskId: string): Promise<DependencyCheckResult> {
    const task = await this.taskManifest.loadTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const result: DependencyCheckResult = {
      allSatisfied: true,
      satisfiedDependencies: [],
      unsatisfiedDependencies: [],
      blockedBy: [],
    };

    for (const dependency of task.dependencies) {
      const dependentTask = await this.taskManifest.loadTask(dependency.taskId);
      
      if (!dependentTask) {
        result.allSatisfied = false;
        result.unsatisfiedDependencies.push(dependency);
        result.blockedBy.push(`Dependent task ${dependency.taskId} not found`);
        continue;
      }

      const isSatisfied = this.isDependencySatisfied(dependency, dependentTask);
      
      if (isSatisfied) {
        result.satisfiedDependencies.push(dependency);
      } else {
        result.allSatisfied = false;
        result.unsatisfiedDependencies.push(dependency);
        result.blockedBy.push(`Task ${dependentTask.name} (${dependentTask.status})`);
      }
    }

    return result;
  }

  /**
   * Complete task execution
   */
  async completeTask(
    taskId: string,
    completionNotes?: string
  ): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      success: false,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      const task = await this.taskManifest.loadTask(taskId);
      if (!task) {
        result.errors.push(`Task ${taskId} not found`);
        return result;
      }

      // Update task status
      await this.taskManifest.updateTask(taskId, {
        status: TaskStatus.COMPLETED,
        progress: {
          ...task.progress,
          completionPercentage: 100,
          lastUpdated: new Date(),
        },
        metadata: {
          ...task.metadata,
          completionNotes,
          completedAt: new Date().toISOString(),
        },
      });

      // Complete associated session
      if (task.sessionId) {
        await this.sessionRegistry.updateSession(task.sessionId, {
          state: SessionState.COMPLETED,
        });
      }

      result.success = true;

    } catch (error) {
      result.errors.push(`Failed to complete task: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Create task execution session
   */
  private async createTaskSession(
    task: Task,
    options: TaskExecutionOptions
  ): Promise<OrchestrationSession> {
    const sessionParams: CreateSessionParams = {
      type: SessionType.TASK,
      orchestrationId: task.orchestrationId,
      taskId: task.id,
      initialFocus: `Implementing: ${task.name}`,
      metadata: {
        name: `Task Implementation: ${task.name}`,
        description: task.description,
        tags: ['task', 'implementation'],
        userMetadata: {
          taskId: task.id,
          taskName: task.name,
          taskPriority: task.priority,
          ...options.sessionMetadata,
        },
      },
    };

    return await this.sessionRegistry.createSession(sessionParams);
  }

  /**
   * Create verification session
   */
  private async createVerificationSession(task: Task): Promise<OrchestrationSession> {
    const sessionParams: CreateSessionParams = {
      type: SessionType.VERIFICATION,
      orchestrationId: task.orchestrationId,
      taskId: task.id,
      initialFocus: `Verifying: ${task.name}`,
      metadata: {
        name: `Task Verification: ${task.name}`,
        description: `Verification session for ${task.name}`,
        tags: ['verification', 'quality'],
        userMetadata: {
          taskId: task.id,
          taskName: task.name,
          verificationType: 'task_completion',
        },
      },
    };

    return await this.sessionRegistry.createSession(sessionParams);
  }

  /**
   * Load context for task execution
   */
  private async loadTaskContext(
    session: OrchestrationSession,
    task: Task
  ): Promise<{
    planningContext: boolean;
    taskSpecs: boolean;
    dependencies: boolean;
  }> {
    const result = {
      planningContext: false,
      taskSpecs: false,
      dependencies: false,
    };

    try {
      // Load task-specific context
      const taskContext = await this.contextLoader.loadTaskContext(task.id, true);
      
      if (taskContext) {
        // Add task specifications to session
        session.addArtifact({
          type: 'task_specification',
          name: `${task.name} - Specifications`,
          content: JSON.stringify({
            name: task.name,
            description: task.description,
            acceptanceCriteria: task.acceptanceCriteria,
            estimation: task.estimation,
            priority: task.priority,
          }, null, 2),
        });

        result.taskSpecs = true;

        // Add planning context if available
        if (taskContext.parentContext) {
          session.addArtifact({
            type: 'planning_context',
            name: 'Planning Context',
            content: JSON.stringify(taskContext.parentContext, null, 2),
          });
          result.planningContext = true;
        }

        // Add dependency information
        if (task.dependencies.length > 0) {
          session.addArtifact({
            type: 'dependencies',
            name: 'Task Dependencies',
            content: JSON.stringify(task.dependencies, null, 2),
          });
          result.dependencies = true;
        }
      }

    } catch (error) {
      console.warn('Failed to load task context:', error);
    }

    return result;
  }

  /**
   * Check if a dependency is satisfied
   */
  private isDependencySatisfied(dependency: TaskDependency, dependentTask: Task): boolean {
    switch (dependency.type) {
      case DependencyType.FINISH_TO_START:
        return dependentTask.status === TaskStatus.COMPLETED;
      
      case DependencyType.START_TO_START:
        return dependentTask.status === TaskStatus.IN_PROGRESS || 
               dependentTask.status === TaskStatus.COMPLETED;
      
      case DependencyType.FINISH_TO_FINISH:
        // For this type, we need both tasks to be completed
        return dependentTask.status === TaskStatus.COMPLETED;
      
      case DependencyType.START_TO_FINISH:
        // This task can't finish until the dependent task starts
        return dependentTask.status === TaskStatus.IN_PROGRESS || 
               dependentTask.status === TaskStatus.COMPLETED;
      
      default:
        return false;
    }
  }
}
