/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { 
  ErrorHandler, 
  OrchestrationError, 
  OrchestrationErrorType,
  createOrchestrationError 
} from '../ErrorHandler.js';

describe('ErrorHandler', () => {
  const errorHandler = new ErrorHandler();

  describe('OrchestrationError', () => {
    it('should create error with correct properties', () => {
      const error = new OrchestrationError(
        OrchestrationErrorType.SESSION_NOT_FOUND,
        'Test error message',
        { sessionId: 'test-123' },
        true
      );

      expect(error.type).toBe(OrchestrationErrorType.SESSION_NOT_FOUND);
      expect(error.message).toBe('Test error message');
      expect(error.context).toEqual({ sessionId: 'test-123' });
      expect(error.recoverable).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should format display message correctly', () => {
      const error = new OrchestrationError(
        OrchestrationErrorType.VALIDATION_ERROR,
        'Validation failed',
        { field: 'name', value: 'invalid' },
        true
      );

      const displayMessage = error.toDisplayMessage();
      expect(displayMessage).toContain('VALIDATION ERROR');
      expect(displayMessage).toContain('Validation failed');
      expect(displayMessage).toContain('field: name');
      expect(displayMessage).toContain('value: invalid');
      expect(displayMessage).toContain('recoverable');
    });
  });

  describe('handleError', () => {
    it('should handle OrchestrationError', async () => {
      const error = createOrchestrationError.sessionNotFound('test-session');
      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Session not found');
      expect(result.actions).toBeDefined();
      expect(result.actions!.length).toBeGreaterThan(0);
    });

    it('should handle regular Error', async () => {
      const error = new Error('Regular error message');
      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Regular error message');
    });

    it('should provide recovery actions for session not found', async () => {
      const error = createOrchestrationError.sessionNotFound('test-session');
      const result = await errorHandler.handleError(error);

      expect(result.actions).toBeDefined();
      const actions = result.actions!;
      expect(actions.some(a => a.command === '/sessions')).toBe(true);
      expect(actions.some(a => a.command === '/plan')).toBe(true);
    });

    it('should provide recovery actions for session corruption', async () => {
      const error = createOrchestrationError.sessionCorrupted('test-session', 'JSON parse error');
      const result = await errorHandler.handleError(error);

      expect(result.actions).toBeDefined();
      const actions = result.actions!;
      expect(actions.some(a => a.description.includes('backup'))).toBe(true);
      expect(actions.some(a => a.command === '/sessions --cleanup')).toBe(true);
    });

    it('should provide recovery actions for storage errors', async () => {
      const error = createOrchestrationError.storageError('save', 'Disk full');
      const result = await errorHandler.handleError(error);

      expect(result.actions).toBeDefined();
      const actions = result.actions!;
      expect(actions.some(a => a.description.includes('permissions'))).toBe(true);
      expect(actions.some(a => a.description.includes('disk space'))).toBe(true);
    });

    it('should provide recovery actions for validation errors', async () => {
      const error = createOrchestrationError.validationError('name', 'invalid', 'Too short');
      const result = await errorHandler.handleError(error);

      expect(result.actions).toBeDefined();
      const actions = result.actions!;
      expect(actions.some(a => a.description.includes('input'))).toBe(true);
    });

    it('should provide recovery actions for state transition errors', async () => {
      const error = createOrchestrationError.stateTransitionError('active', 'invalid', 'Not allowed');
      const result = await errorHandler.handleError(error);

      expect(result.actions).toBeDefined();
      const actions = result.actions!;
      expect(actions.some(a => a.command === '/context')).toBe(true);
    });

    it('should provide generic recovery actions for unknown errors', async () => {
      const error = new OrchestrationError(
        OrchestrationErrorType.EXECUTION_ERROR,
        'Unknown error',
        {},
        true
      );
      const result = await errorHandler.handleError(error);

      expect(result.actions).toBeDefined();
      const actions = result.actions!;
      expect(actions.some(a => a.command === '/task_status')).toBe(true);
      expect(actions.some(a => a.command === '/sessions')).toBe(true);
      expect(actions.some(a => a.command === '/orchestration_help')).toBe(true);
    });
  });

  describe('createOrchestrationError helpers', () => {
    it('should create session not found error', () => {
      const error = createOrchestrationError.sessionNotFound('test-session');
      expect(error.type).toBe(OrchestrationErrorType.SESSION_NOT_FOUND);
      expect(error.message).toContain('test-session');
      expect(error.context?.sessionId).toBe('test-session');
    });

    it('should create session corrupted error', () => {
      const error = createOrchestrationError.sessionCorrupted('test-session', 'Parse error');
      expect(error.type).toBe(OrchestrationErrorType.SESSION_CORRUPTED);
      expect(error.message).toContain('test-session');
      expect(error.message).toContain('Parse error');
      expect(error.context?.sessionId).toBe('test-session');
      expect(error.context?.details).toBe('Parse error');
    });

    it('should create task not found error', () => {
      const error = createOrchestrationError.taskNotFound('test-task');
      expect(error.type).toBe(OrchestrationErrorType.TASK_NOT_FOUND);
      expect(error.message).toContain('test-task');
      expect(error.context?.taskId).toBe('test-task');
    });

    it('should create plan not found error', () => {
      const error = createOrchestrationError.planNotFound('test-orch');
      expect(error.type).toBe(OrchestrationErrorType.PLAN_NOT_FOUND);
      expect(error.message).toContain('test-orch');
      expect(error.context?.orchestrationId).toBe('test-orch');
    });

    it('should create storage error', () => {
      const error = createOrchestrationError.storageError('save', 'Disk full');
      expect(error.type).toBe(OrchestrationErrorType.STORAGE_ERROR);
      expect(error.message).toContain('save');
      expect(error.message).toContain('Disk full');
      expect(error.context?.operation).toBe('save');
      expect(error.context?.details).toBe('Disk full');
    });

    it('should create validation error', () => {
      const error = createOrchestrationError.validationError('name', 'test', 'Too short');
      expect(error.type).toBe(OrchestrationErrorType.VALIDATION_ERROR);
      expect(error.message).toContain('name');
      expect(error.message).toContain('Too short');
      expect(error.context?.field).toBe('name');
      expect(error.context?.value).toBe('test');
      expect(error.context?.reason).toBe('Too short');
    });

    it('should create state transition error', () => {
      const error = createOrchestrationError.stateTransitionError('active', 'invalid', 'Not allowed');
      expect(error.type).toBe(OrchestrationErrorType.STATE_TRANSITION_ERROR);
      expect(error.message).toContain('active');
      expect(error.message).toContain('invalid');
      expect(error.message).toContain('Not allowed');
      expect(error.context?.from).toBe('active');
      expect(error.context?.to).toBe('invalid');
      expect(error.context?.reason).toBe('Not allowed');
    });
  });

  describe('error recovery priorities', () => {
    it('should assign correct priorities to recovery actions', async () => {
      const error = createOrchestrationError.sessionNotFound('test-session');
      const result = await errorHandler.handleError(error);

      expect(result.actions).toBeDefined();
      const actions = result.actions!;
      
      // Check that high priority actions exist
      const highPriorityActions = actions.filter(a => a.priority === 'high');
      expect(highPriorityActions.length).toBeGreaterThan(0);
      
      // Check that actions have appropriate priorities
      const listSessionsAction = actions.find(a => a.command === '/sessions');
      expect(listSessionsAction?.priority).toBe('high');
      
      const createPlanAction = actions.find(a => a.command === '/plan');
      expect(createPlanAction?.priority).toBe('medium');
    });
  });
});
