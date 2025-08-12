/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { ValidationUtils } from '../ValidationUtils.js';
import { SessionState, SessionType } from '../../types/session.js';
import { TaskStatus, TaskPriority } from '../../types/task.js';

describe('ValidationUtils', () => {
  describe('validateSession', () => {
    it('should validate a valid session', () => {
      const validSession = {
        id: 'session-123-abc',
        type: SessionType.PLANNING,
        state: SessionState.ACTIVE,
        orchestrationId: 'orch-456',
        timestamp: new Date(),
        lastActivityAt: new Date(),
        context: {
          currentFocus: 'Planning phase',
          messages: [],
          artifacts: [],
          decisions: [],
          sequentialThinking: {
            steps: [],
          },
          variables: {},
        },
        childSessionIds: [],
        metadata: {
          name: 'Test Session',
          tags: ['test'],
        },
      };

      const result = ValidationUtils.validateSession(validSession);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.session).toBeDefined();
    });

    it('should reject session with missing required fields', () => {
      const invalidSession = {
        type: SessionType.PLANNING,
        // Missing id, state, orchestrationId, startTime
      };

      const result = ValidationUtils.validateSession(invalidSession);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('id'))).toBe(true);
    });

    it('should reject session with invalid enum values', () => {
      const invalidSession = {
        id: 'session-123-abc',
        type: 'invalid-type',
        state: 'invalid-state',
        orchestrationId: 'orch-456',
        startTime: new Date(),
      };

      const result = ValidationUtils.validateSession(invalidSession);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
      expect(result.errors.some(e => e.includes('state'))).toBe(true);
    });
  });

  describe('validateTask', () => {
    it('should validate a valid task', () => {
      const validTask = {
        id: 'task-123-abc',
        name: 'Test Task',
        description: 'A test task',
        status: TaskStatus.NOT_STARTED,
        priority: TaskPriority.MEDIUM,
        orchestrationId: 'orch-456',
        dependencies: [],
        acceptanceCriteria: [],
        progress: {
          completionPercentage: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = ValidationUtils.validateTask(validTask);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.task).toBeDefined();
    });

    it('should reject task with invalid completion percentage', () => {
      const invalidTask = {
        id: 'task-123-abc',
        name: 'Test Task',
        description: 'A test task',
        status: TaskStatus.NOT_STARTED,
        priority: TaskPriority.MEDIUM,
        orchestrationId: 'orch-456',
        dependencies: [],
        acceptanceCriteria: [],
        progress: {
          completionPercentage: 150, // Invalid: > 100
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = ValidationUtils.validateTask(invalidTask);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('completionPercentage'))).toBe(true);
    });
  });

  describe('validateStateTransition', () => {
    it('should allow valid state transitions', () => {
      const validTransitions = [
        [SessionState.ACTIVE, SessionState.SUSPENDED],
        [SessionState.ACTIVE, SessionState.COMPLETED],
        [SessionState.SUSPENDED, SessionState.ACTIVE],
        [SessionState.FAILED, SessionState.ACTIVE],
      ];

      for (const [from, to] of validTransitions) {
        const result = ValidationUtils.validateStateTransition(from, to);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it('should reject invalid state transitions', () => {
      const invalidTransitions = [
        [SessionState.COMPLETED, SessionState.ACTIVE],
        [SessionState.COMPLETED, SessionState.SUSPENDED],
        [SessionState.COMPLETED, SessionState.FAILED],
      ];

      for (const [from, to] of invalidTransitions) {
        const result = ValidationUtils.validateStateTransition(from, to);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('validateTaskStatusTransition', () => {
    it('should allow valid task status transitions', () => {
      const validTransitions = [
        [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS],
        [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED],
        [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        [TaskStatus.BLOCKED, TaskStatus.IN_PROGRESS],
        [TaskStatus.FAILED, TaskStatus.IN_PROGRESS],
      ];

      for (const [from, to] of validTransitions) {
        const result = ValidationUtils.validateTaskStatusTransition(from, to);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it('should reject invalid task status transitions', () => {
      const invalidTransitions = [
        [TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS],
        [TaskStatus.NOT_STARTED, TaskStatus.COMPLETED],
        [TaskStatus.BLOCKED, TaskStatus.COMPLETED],
      ];

      for (const [from, to] of invalidTransitions) {
        const result = ValidationUtils.validateTaskStatusTransition(from, to);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('validateTaskDependencies', () => {
    it('should validate tasks with no dependencies', () => {
      const tasks = [
        { id: 'task-1', dependencies: [] },
        { id: 'task-2', dependencies: [] },
      ];

      const result = ValidationUtils.validateTaskDependencies(tasks);
      expect(result.isValid).toBe(true);
      expect(result.cycles).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate tasks with valid dependencies', () => {
      const tasks = [
        { id: 'task-1', dependencies: [] },
        { id: 'task-2', dependencies: [{ taskId: 'task-1', type: 'requires' }] },
        { id: 'task-3', dependencies: [{ taskId: 'task-2', type: 'requires' }] },
      ];

      const result = ValidationUtils.validateTaskDependencies(tasks);
      expect(result.isValid).toBe(true);
      expect(result.cycles).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect circular dependencies', () => {
      const tasks = [
        { id: 'task-1', dependencies: [{ taskId: 'task-2', type: 'requires' }] },
        { id: 'task-2', dependencies: [{ taskId: 'task-1', type: 'requires' }] },
      ];

      const result = ValidationUtils.validateTaskDependencies(tasks);
      expect(result.isValid).toBe(false);
      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Circular dependencies'))).toBe(true);
    });

    it('should detect invalid dependencies', () => {
      const tasks = [
        { id: 'task-1', dependencies: [{ taskId: 'nonexistent-task', type: 'requires' }] },
      ];

      const result = ValidationUtils.validateTaskDependencies(tasks);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid dependency'))).toBe(true);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize valid input', () => {
      const input = '  Valid input text  ';
      const result = ValidationUtils.sanitizeInput(input);
      expect(result).toBe('Valid input text');
    });

    it('should remove dangerous characters', () => {
      const input = 'Text with <script> and {dangerous} content';
      const result = ValidationUtils.sanitizeInput(input);
      expect(result).toBe('Text with script and dangerous content');
    });

    it('should reject input that is too long', () => {
      const longInput = 'a'.repeat(1001);
      expect(() => ValidationUtils.sanitizeInput(longInput)).toThrow();
    });

    it('should reject empty input', () => {
      expect(() => ValidationUtils.sanitizeInput('')).toThrow();
      expect(() => ValidationUtils.sanitizeInput('   ')).toThrow();
    });

    it('should reject non-string input', () => {
      expect(() => ValidationUtils.sanitizeInput(123 as any)).toThrow();
      expect(() => ValidationUtils.sanitizeInput(null as any)).toThrow();
    });
  });

  describe('ID validation', () => {
    it('should validate orchestration IDs', () => {
      expect(ValidationUtils.validateOrchestrationId('valid-id-123')).toBe(true);
      expect(ValidationUtils.validateOrchestrationId('valid_id_123')).toBe(true);
      expect(ValidationUtils.validateOrchestrationId('ab')).toBe(false); // Too short
      expect(ValidationUtils.validateOrchestrationId('a'.repeat(51))).toBe(false); // Too long
      expect(ValidationUtils.validateOrchestrationId('invalid@id')).toBe(false); // Invalid chars
    });

    it('should validate session IDs', () => {
      expect(ValidationUtils.validateSessionId('session-123-abc')).toBe(true);
      expect(ValidationUtils.validateSessionId('invalid-format')).toBe(false);
      expect(ValidationUtils.validateSessionId('session-abc-123')).toBe(false); // Non-numeric timestamp
    });

    it('should validate task IDs', () => {
      expect(ValidationUtils.validateTaskId('task-123-abc')).toBe(true);
      expect(ValidationUtils.validateTaskId('invalid-format')).toBe(false);
      expect(ValidationUtils.validateTaskId('task-abc-123')).toBe(false); // Non-numeric timestamp
    });
  });
});
