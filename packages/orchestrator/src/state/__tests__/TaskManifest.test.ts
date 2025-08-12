/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskManifest } from '../TaskManifest.js';
import { TaskStatus, TaskPriority } from '../../types/task.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('TaskManifest', () => {
  let taskManifest: TaskManifest;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-manifest-test-'));
    taskManifest = new TaskManifest(tempDir);
    await taskManifest.initialize();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      const taskParams = {
        name: 'Test Task',
        description: 'A test task for validation',
        orchestrationId: 'test-orch-123',
        priority: TaskPriority.MEDIUM,
        acceptanceCriteria: [
          { description: 'Should pass tests', isMet: false },
        ],
        estimation: {
          effortHours: 4,
          confidence: 0.8,
        },
      };

      const task = await taskManifest.createTask(taskParams);

      expect(task).toBeDefined();
      expect(task.id).toMatch(/^task-\d+-[a-zA-Z0-9]+$/);
      expect(task.name).toBe('Test Task');
      expect(task.status).toBe(TaskStatus.NOT_STARTED);
      expect(task.priority).toBe(TaskPriority.MEDIUM);
      expect(task.progress.completionPercentage).toBe(0);
      expect(task.acceptanceCriteria).toHaveLength(1);
      expect(task.estimation?.effortHours).toBe(4);
    });

    it('should create task with dependencies', async () => {
      // Create prerequisite task
      const prerequisite = await taskManifest.createTask({
        name: 'Prerequisite Task',
        description: 'Must be completed first',
        orchestrationId: 'test-orch-123',
        priority: TaskPriority.HIGH,
      });

      // Create dependent task
      const dependent = await taskManifest.createTask({
        name: 'Dependent Task',
        description: 'Depends on prerequisite',
        orchestrationId: 'test-orch-123',
        priority: TaskPriority.MEDIUM,
        dependencies: [
          { taskId: prerequisite.id, type: 'requires' },
        ],
      });

      expect(dependent.dependencies).toHaveLength(1);
      expect(dependent.dependencies[0].taskId).toBe(prerequisite.id);
      expect(dependent.dependencies[0].type).toBe('requires');
    });
  });

  describe('loadTask', () => {
    it('should load existing task', async () => {
      const task = await taskManifest.createTask({
        name: 'Test Task',
        description: 'A test task',
        orchestrationId: 'test-orch-123',
        priority: TaskPriority.LOW,
      });

      const loaded = await taskManifest.loadTask(task.id);
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(task.id);
      expect(loaded?.name).toBe('Test Task');
    });

    it('should return null for non-existent task', async () => {
      const loaded = await taskManifest.loadTask('non-existent-task');
      expect(loaded).toBeNull();
    });
  });

  describe('updateTask', () => {
    it('should update task properties', async () => {
      const task = await taskManifest.createTask({
        name: 'Test Task',
        description: 'A test task',
        orchestrationId: 'test-orch-123',
        priority: TaskPriority.LOW,
      });

      await taskManifest.updateTask(task.id, {
        status: TaskStatus.IN_PROGRESS,
        progress: { completionPercentage: 50 },
      });

      const updated = await taskManifest.loadTask(task.id);
      expect(updated?.status).toBe(TaskStatus.IN_PROGRESS);
      expect(updated?.progress.completionPercentage).toBe(50);
    });

    it('should update acceptance criteria', async () => {
      const task = await taskManifest.createTask({
        name: 'Test Task',
        description: 'A test task',
        orchestrationId: 'test-orch-123',
        priority: TaskPriority.MEDIUM,
        acceptanceCriteria: [
          { description: 'Criterion 1', isMet: false },
          { description: 'Criterion 2', isMet: false },
        ],
      });

      await taskManifest.updateTask(task.id, {
        acceptanceCriteria: [
          { description: 'Criterion 1', isMet: true },
          { description: 'Criterion 2', isMet: false },
        ],
      });

      const updated = await taskManifest.loadTask(task.id);
      expect(updated?.acceptanceCriteria[0].isMet).toBe(true);
      expect(updated?.acceptanceCriteria[1].isMet).toBe(false);
    });
  });

  describe('queryTasks', () => {
    beforeEach(async () => {
      // Create test tasks
      await taskManifest.createTask({
        name: 'Planning Task',
        description: 'Planning phase task',
        orchestrationId: 'orch-1',
        priority: TaskPriority.HIGH,
        status: TaskStatus.COMPLETED,
      });

      await taskManifest.createTask({
        name: 'Implementation Task',
        description: 'Implementation phase task',
        orchestrationId: 'orch-1',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
      });

      await taskManifest.createTask({
        name: 'Testing Task',
        description: 'Testing phase task',
        orchestrationId: 'orch-2',
        priority: TaskPriority.LOW,
        status: TaskStatus.NOT_STARTED,
      });
    });

    it('should query tasks by orchestration ID', async () => {
      const tasks = await taskManifest.queryTasks({ orchestrationId: 'orch-1' });
      expect(tasks).toHaveLength(2);
      expect(tasks.every(t => t.orchestrationId === 'orch-1')).toBe(true);
    });

    it('should query tasks by status', async () => {
      const tasks = await taskManifest.queryTasks({ status: TaskStatus.IN_PROGRESS });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should query tasks by priority', async () => {
      const tasks = await taskManifest.queryTasks({ priority: TaskPriority.HIGH });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe(TaskPriority.HIGH);
    });

    it('should query with multiple filters', async () => {
      const tasks = await taskManifest.queryTasks({
        orchestrationId: 'orch-1',
        status: TaskStatus.COMPLETED,
      });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].orchestrationId).toBe('orch-1');
      expect(tasks[0].status).toBe(TaskStatus.COMPLETED);
    });
  });

  describe('getNextTask', () => {
    it('should return next available task', async () => {
      const orchestrationId = 'test-orch-next';

      // Create tasks with different statuses
      await taskManifest.createTask({
        name: 'Completed Task',
        description: 'Already done',
        orchestrationId,
        priority: TaskPriority.HIGH,
        status: TaskStatus.COMPLETED,
      });

      const nextTask = await taskManifest.createTask({
        name: 'Next Task',
        description: 'Should be next',
        orchestrationId,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.NOT_STARTED,
      });

      await taskManifest.createTask({
        name: 'Lower Priority Task',
        description: 'Lower priority',
        orchestrationId,
        priority: TaskPriority.LOW,
        status: TaskStatus.NOT_STARTED,
      });

      const result = await taskManifest.getNextTask(orchestrationId);
      expect(result?.id).toBe(nextTask.id);
    });

    it('should return null when no tasks available', async () => {
      const result = await taskManifest.getNextTask('non-existent-orch');
      expect(result).toBeNull();
    });
  });

  describe('getTaskStatistics', () => {
    it('should calculate task statistics', async () => {
      const orchestrationId = 'test-orch-stats';

      // Create tasks with different statuses and priorities
      await taskManifest.createTask({
        name: 'Task 1',
        description: 'Completed task',
        orchestrationId,
        priority: TaskPriority.HIGH,
        status: TaskStatus.COMPLETED,
        progress: { completionPercentage: 100 },
        estimation: { effortHours: 8 },
      });

      await taskManifest.createTask({
        name: 'Task 2',
        description: 'In progress task',
        orchestrationId,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
        progress: { completionPercentage: 50 },
        estimation: { effortHours: 4 },
      });

      await taskManifest.createTask({
        name: 'Task 3',
        description: 'Not started task',
        orchestrationId,
        priority: TaskPriority.LOW,
        status: TaskStatus.NOT_STARTED,
        progress: { completionPercentage: 0 },
        estimation: { effortHours: 2 },
      });

      const stats = await taskManifest.getTaskStatistics(orchestrationId);

      expect(stats.total).toBe(3);
      expect(stats.byStatus[TaskStatus.COMPLETED]).toBe(1);
      expect(stats.byStatus[TaskStatus.IN_PROGRESS]).toBe(1);
      expect(stats.byStatus[TaskStatus.NOT_STARTED]).toBe(1);
      expect(stats.byPriority[TaskPriority.HIGH]).toBe(1);
      expect(stats.byPriority[TaskPriority.MEDIUM]).toBe(1);
      expect(stats.byPriority[TaskPriority.LOW]).toBe(1);
      expect(stats.completionPercentage).toBe(33); // 1/3 completed
      expect(stats.averageProgress).toBe(50); // (100 + 50 + 0) / 3
      expect(stats.estimatedTotalHours).toBe(14); // 8 + 4 + 2
    });
  });

  describe('validateTaskDependencies', () => {
    it('should validate tasks without cycles', async () => {
      const orchestrationId = 'test-orch-deps';

      const task1 = await taskManifest.createTask({
        name: 'Task 1',
        description: 'First task',
        orchestrationId,
        priority: TaskPriority.HIGH,
      });

      const task2 = await taskManifest.createTask({
        name: 'Task 2',
        description: 'Second task',
        orchestrationId,
        priority: TaskPriority.MEDIUM,
        dependencies: [{ taskId: task1.id, type: 'requires' }],
      });

      const task3 = await taskManifest.createTask({
        name: 'Task 3',
        description: 'Third task',
        orchestrationId,
        priority: TaskPriority.LOW,
        dependencies: [{ taskId: task2.id, type: 'requires' }],
      });

      const validation = await taskManifest.validateTaskDependencies(orchestrationId);
      expect(validation.isValid).toBe(true);
      expect(validation.cycles).toHaveLength(0);
      expect(validation.invalidDependencies).toHaveLength(0);
    });

    it('should detect circular dependencies', async () => {
      const orchestrationId = 'test-orch-cycle';

      const task1 = await taskManifest.createTask({
        name: 'Task 1',
        description: 'First task',
        orchestrationId,
        priority: TaskPriority.HIGH,
      });

      const task2 = await taskManifest.createTask({
        name: 'Task 2',
        description: 'Second task',
        orchestrationId,
        priority: TaskPriority.MEDIUM,
        dependencies: [{ taskId: task1.id, type: 'requires' }],
      });

      // Create circular dependency
      await taskManifest.updateTask(task1.id, {
        dependencies: [{ taskId: task2.id, type: 'requires' }],
      });

      const validation = await taskManifest.validateTaskDependencies(orchestrationId);
      expect(validation.isValid).toBe(false);
      expect(validation.cycles.length).toBeGreaterThan(0);
    });
  });

  describe('exportTaskManifest', () => {
    it('should export to JSON format', async () => {
      const orchestrationId = 'test-orch-export';

      await taskManifest.createTask({
        name: 'Export Test Task',
        description: 'Task for export testing',
        orchestrationId,
        priority: TaskPriority.MEDIUM,
      });

      const exported = await taskManifest.exportTaskManifest(orchestrationId, 'json');
      const parsed = JSON.parse(exported);

      expect(parsed.orchestrationId).toBe(orchestrationId);
      expect(parsed.tasks).toHaveLength(1);
      expect(parsed.tasks[0].name).toBe('Export Test Task');
      expect(parsed.exportedAt).toBeDefined();
    });

    it('should export to CSV format', async () => {
      const orchestrationId = 'test-orch-csv';

      await taskManifest.createTask({
        name: 'CSV Test Task',
        description: 'Task for CSV testing',
        orchestrationId,
        priority: TaskPriority.HIGH,
        estimation: { effortHours: 6 },
      });

      const exported = await taskManifest.exportTaskManifest(orchestrationId, 'csv');
      const lines = exported.split('\n');

      expect(lines[0]).toContain('ID,Name,Description,Status,Priority,Progress,Estimated Hours,Created At');
      expect(lines[1]).toContain('CSV Test Task');
      expect(lines[1]).toContain('6');
    });

    it('should export to Markdown format', async () => {
      const orchestrationId = 'test-orch-md';

      await taskManifest.createTask({
        name: 'Markdown Test Task',
        description: 'Task for Markdown testing',
        orchestrationId,
        priority: TaskPriority.LOW,
        status: TaskStatus.COMPLETED,
        progress: { completionPercentage: 100 },
      });

      const exported = await taskManifest.exportTaskManifest(orchestrationId, 'markdown');

      expect(exported).toContain('# Task Manifest');
      expect(exported).toContain('## Tasks');
      expect(exported).toContain('Markdown Test Task');
      expect(exported).toContain('## Statistics');
      expect(exported).toContain('Total Tasks: 1');
      expect(exported).toContain('Completed: 1 (100%)');
    });
  });
});
