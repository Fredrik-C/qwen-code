/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import { SessionState, SessionType } from '../types/session.js';
import { TaskStatus, TaskPriority } from '../types/task.js';
import { createOrchestrationError } from './ErrorHandler.js';

/**
 * Session validation schema
 */
export const SessionSchema = z.object({
  id: z.string().min(1, 'Session ID cannot be empty'),
  type: z.nativeEnum(SessionType),
  state: z.nativeEnum(SessionState),
  orchestrationId: z.string().min(1, 'Orchestration ID cannot be empty'),
  timestamp: z.union([z.date(), z.string().transform(str => new Date(str))]),
  lastActivityAt: z.union([z.date(), z.string().transform(str => new Date(str))]),
  completedAt: z.union([z.date(), z.string().transform(str => new Date(str))]).optional(),
  failureReason: z.string().optional(),
  parentSessionId: z.string().optional(),
  childSessionIds: z.array(z.string()).default([]),
  context: z.object({
    messages: z.array(z.any()).default([]),
    artifacts: z.array(z.any()).default([]),
    decisions: z.array(z.any()).default([]),
    currentFocus: z.string().optional(),
    sequentialThinking: z.any().optional(),
    variables: z.record(z.unknown()).optional(),
  }).default({}),
  metadata: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    userMetadata: z.record(z.unknown()).optional(),
  }).optional(),
});

/**
 * Task validation schema
 */
export const TaskSchema = z.object({
  id: z.string().min(1, 'Task ID cannot be empty'),
  name: z.string().min(1, 'Task name cannot be empty'),
  description: z.string().min(1, 'Task description cannot be empty'),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority),
  orchestrationId: z.string().min(1, 'Orchestration ID cannot be empty'),
  sessionId: z.string().optional(),
  parentTaskId: z.string().optional(),
  dependencies: z.array(z.object({
    taskId: z.string(),
    type: z.enum(['blocks', 'enables', 'requires']),
  })).default([]),
  acceptanceCriteria: z.array(z.object({
    description: z.string(),
    isMet: z.boolean().default(false),
  })).default([]),
  progress: z.object({
    completionPercentage: z.number().min(0).max(100),
    startedAt: z.union([z.date(), z.string().transform(str => new Date(str))]).optional(),
    completedAt: z.union([z.date(), z.string().transform(str => new Date(str))]).optional(),
  }),
  estimation: z.object({
    effortHours: z.number().positive().optional(),
    durationHours: z.number().positive().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
  createdAt: z.union([z.date(), z.string().transform(str => new Date(str))]),
  updatedAt: z.union([z.date(), z.string().transform(str => new Date(str))]),
});

/**
 * Plan validation schema
 */
export const PlanSchema = z.object({
  id: z.string().min(1, 'Plan ID cannot be empty'),
  name: z.string().min(1, 'Plan name cannot be empty'),
  description: z.string().min(1, 'Plan description cannot be empty'),
  orchestrationId: z.string().min(1, 'Orchestration ID cannot be empty'),
  status: z.enum(['draft', 'approved', 'in_progress', 'completed', 'cancelled']),
  phases: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tasks: z.array(z.string()),
    dependencies: z.array(z.string()).default([]),
  })).min(1, 'Plan must have at least one phase'),
  metadata: z.object({
    estimatedHours: z.number().positive().optional(),
    complexity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    tags: z.array(z.string()).default([]),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate session data
   */
  static validateSession(data: any): { isValid: boolean; errors: string[]; session?: any } {
    try {
      const session = SessionSchema.parse(data);
      return { isValid: true, errors: [], session };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return { isValid: false, errors };
      }
      return { isValid: false, errors: [String(error)] };
    }
  }

  /**
   * Validate task data
   */
  static validateTask(data: any): { isValid: boolean; errors: string[]; task?: any } {
    try {
      const task = TaskSchema.parse(data);
      return { isValid: true, errors: [], task };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return { isValid: false, errors };
      }
      return { isValid: false, errors: [String(error)] };
    }
  }

  /**
   * Validate plan data
   */
  static validatePlan(data: any): { isValid: boolean; errors: string[]; plan?: any } {
    try {
      const plan = PlanSchema.parse(data);
      return { isValid: true, errors: [], plan };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return { isValid: false, errors };
      }
      return { isValid: false, errors: [String(error)] };
    }
  }

  /**
   * Validate session state transition
   */
  static validateStateTransition(from: SessionState, to: SessionState): { isValid: boolean; error?: string } {
    // Allow same state transitions
    if (from === to) {
      return { isValid: true };
    }

    const validTransitions: Record<SessionState, SessionState[]> = {
      [SessionState.ACTIVE]: [SessionState.SUSPENDED, SessionState.COMPLETED, SessionState.FAILED],
      [SessionState.SUSPENDED]: [SessionState.ACTIVE, SessionState.COMPLETED, SessionState.FAILED],
      [SessionState.COMPLETED]: [], // Terminal state
      [SessionState.FAILED]: [SessionState.ACTIVE], // Can retry
    };

    const allowedStates = validTransitions[from] || [];
    if (!allowedStates.includes(to)) {
      return {
        isValid: false,
        error: `Invalid transition from ${from} to ${to}. Allowed transitions: ${allowedStates.join(', ')}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate task status transition
   */
  static validateTaskStatusTransition(from: TaskStatus, to: TaskStatus): { isValid: boolean; error?: string } {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.NOT_STARTED]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.COMPLETED, TaskStatus.BLOCKED, TaskStatus.FAILED, TaskStatus.CANCELLED],
      [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.COMPLETED]: [], // Terminal state
      [TaskStatus.FAILED]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.CANCELLED]: [TaskStatus.NOT_STARTED], // Can restart
    };

    const allowedStates = validTransitions[from] || [];
    if (!allowedStates.includes(to)) {
      return {
        isValid: false,
        error: `Invalid task status transition from ${from} to ${to}. Allowed transitions: ${allowedStates.join(', ')}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate task dependencies for cycles
   */
  static validateTaskDependencies(tasks: any[]): { isValid: boolean; cycles: string[][]; errors: string[] } {
    const errors: string[] = [];
    const cycles: string[][] = [];
    const taskIds = new Set(tasks.map(t => t.id));

    // Check for invalid dependencies
    for (const task of tasks) {
      for (const dependency of task.dependencies || []) {
        if (!taskIds.has(dependency.taskId)) {
          errors.push(`Task ${task.id} has invalid dependency: ${dependency.taskId}`);
        }
      }
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (taskId: string, path: string[]): boolean => {
      if (recursionStack.has(taskId)) {
        // Found cycle
        const cycleStart = path.indexOf(taskId);
        cycles.push(path.slice(cycleStart).concat(taskId));
        return true;
      }
      
      if (visited.has(taskId)) {
        return false;
      }
      
      visited.add(taskId);
      recursionStack.add(taskId);
      
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        for (const dependency of task.dependencies || []) {
          if (taskIds.has(dependency.taskId)) {
            if (hasCycle(dependency.taskId, [...path, taskId])) {
              return true;
            }
          }
        }
      }
      
      recursionStack.delete(taskId);
      return false;
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        hasCycle(task.id, []);
      }
    }

    if (cycles.length > 0) {
      errors.push(`Circular dependencies detected: ${cycles.map(cycle => cycle.join(' -> ')).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      cycles,
      errors,
    };
  }

  /**
   * Sanitize and validate user input
   */
  static sanitizeInput(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
      throw createOrchestrationError.validationError('input', input, 'Must be a string');
    }

    // Remove potentially dangerous characters
    const sanitized = input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/[{}]/g, '') // Remove curly braces
      .trim();

    if (sanitized.length > maxLength) {
      throw createOrchestrationError.validationError('input', input, `Must be ${maxLength} characters or less`);
    }

    if (sanitized.length === 0) {
      throw createOrchestrationError.validationError('input', input, 'Cannot be empty');
    }

    return sanitized;
  }

  /**
   * Validate orchestration ID format
   */
  static validateOrchestrationId(id: string): boolean {
    const pattern = /^[a-zA-Z0-9_-]+$/;
    return pattern.test(id) && id.length >= 3 && id.length <= 50;
  }

  /**
   * Validate session ID format
   */
  static validateSessionId(id: string): boolean {
    const pattern = /^session-[0-9]+-[a-zA-Z0-9]+$/;
    return pattern.test(id);
  }

  /**
   * Validate task ID format
   */
  static validateTaskId(id: string): boolean {
    const pattern = /^task-[0-9]+-[a-zA-Z0-9]+$/;
    return pattern.test(id);
  }
}
