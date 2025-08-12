/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import {
  Task,
  TaskQuery,
  CreateTaskParams,
  UpdateTaskParams,
  TaskStatus,
  TaskPriority,
  DependencyType
} from '../types/task.js';
import { 
  DevelopmentPlan, 
  CreatePlanParams, 
  UpdatePlanParams, 
  PlanStatus 
} from '../types/planning.js';
import { StorageError, ValidationError, CorruptionError } from './StateManager.js';

/**
 * Task manifest for managing development plans and tasks
 */
export class TaskManifest {
  private baseDir: string;
  private tasksDir: string;
  private plansDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.tasksDir = path.join(baseDir, 'tasks');
    this.plansDir = path.join(baseDir, 'plans');
  }

  /**
   * Initialize task manifest storage
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        fs.mkdir(this.tasksDir, { recursive: true }),
        fs.mkdir(this.plansDir, { recursive: true }),
      ]);
    } catch (error) {
      throw new StorageError(
        'Failed to initialize task manifest storage',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Create a new development plan
   */
  async createPlan(params: CreatePlanParams): Promise<DevelopmentPlan> {
    const plan: DevelopmentPlan = {
      id: this.generateId(),
      name: params.name,
      description: params.description,
      status: PlanStatus.DRAFT,
      currentPhase: 'requirements_analysis' as any,
      requirements: params.requirements?.map(req => ({
        ...req,
        id: this.generateId(),
        status: 'identified' as any,
      })) || [],
      architectureDecisions: params.architectureDecisions?.map(decision => ({
        ...decision,
        id: this.generateId(),
        date: new Date(),
        status: 'proposed' as any,
      })) || [],
      phases: [],
      tasks: [],
      risks: [],
      qualityGates: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: params.metadata || {},
    };

    await this.savePlan(plan);
    return plan;
  }

  /**
   * Save development plan
   */
  async savePlan(plan: DevelopmentPlan): Promise<void> {
    try {
      const filePath = path.join(this.plansDir, `${plan.id}.json`);
      const data = JSON.stringify(plan, null, 2);
      await fs.writeFile(filePath, data, 'utf-8');
    } catch (error) {
      throw new StorageError(
        `Failed to save plan ${plan.id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Load development plan
   */
  async loadPlan(planId: string): Promise<DevelopmentPlan | null> {
    try {
      const filePath = path.join(this.plansDir, `${planId}.json`);
      
      try {
        await fs.access(filePath);
      } catch {
        return null;
      }

      const data = await fs.readFile(filePath, 'utf-8');
      const plan = JSON.parse(data);
      
      // Convert date strings back to Date objects
      plan.createdAt = new Date(plan.createdAt);
      plan.updatedAt = new Date(plan.updatedAt);
      if (plan.approvedAt) plan.approvedAt = new Date(plan.approvedAt);
      if (plan.completedAt) plan.completedAt = new Date(plan.completedAt);
      
      return plan as DevelopmentPlan;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new CorruptionError(
          `Plan file ${planId} is corrupted`,
          path.join(this.plansDir, `${planId}.json`)
        );
      }
      throw new StorageError(
        `Failed to load plan ${planId}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Update development plan
   */
  async updatePlan(planId: string, params: UpdatePlanParams): Promise<DevelopmentPlan | null> {
    const plan = await this.loadPlan(planId);
    if (!plan) return null;

    const updatedPlan: DevelopmentPlan = {
      ...plan,
      ...params,
      updatedAt: new Date(),
    };

    await this.savePlan(updatedPlan);
    return updatedPlan;
  }

  /**
   * Create a new task
   */
  async createTask(params: CreateTaskParams): Promise<Task> {
    const task: Task = {
      id: this.generateTaskId(),
      name: params.name,
      description: params.description,
      status: TaskStatus.NOT_STARTED,
      priority: params.priority || TaskPriority.MEDIUM,
      orchestrationId: params.orchestrationId,
      parentTaskId: params.parentTaskId,
      childTaskIds: [],
      dependencies: params.dependencies || [],
      acceptanceCriteria: params.acceptanceCriteria?.map(criteria => ({
        ...criteria,
        id: this.generateId(),
        isMet: false,
      })) || [],
      estimation: params.estimation,
      progress: {
        completionPercentage: 0,
        lastUpdated: new Date(),
        milestones: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      assignee: params.assignee,
      tags: params.tags || [],
      metadata: params.metadata || {},
    };

    await this.saveTask(task);
    return task;
  }

  /**
   * Save task
   */
  async saveTask(task: Task): Promise<void> {
    try {
      const filePath = path.join(this.tasksDir, `${task.id}.json`);
      const data = JSON.stringify(task, null, 2);
      await fs.writeFile(filePath, data, 'utf-8');
    } catch (error) {
      throw new StorageError(
        `Failed to save task ${task.id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Load task
   */
  async loadTask(taskId: string): Promise<Task | null> {
    try {
      const filePath = path.join(this.tasksDir, `${taskId}.json`);
      
      try {
        await fs.access(filePath);
      } catch {
        return null;
      }

      const data = await fs.readFile(filePath, 'utf-8');
      const task = JSON.parse(data);
      
      // Convert date strings back to Date objects
      task.createdAt = new Date(task.createdAt);
      task.updatedAt = new Date(task.updatedAt);
      if (task.startedAt) task.startedAt = new Date(task.startedAt);
      if (task.completedAt) task.completedAt = new Date(task.completedAt);
      task.progress.lastUpdated = new Date(task.progress.lastUpdated);
      
      return task as Task;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new CorruptionError(
          `Task file ${taskId} is corrupted`,
          path.join(this.tasksDir, `${taskId}.json`)
        );
      }
      throw new StorageError(
        `Failed to load task ${taskId}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, params: UpdateTaskParams): Promise<Task | null> {
    const task = await this.loadTask(taskId);
    if (!task) return null;

    // Handle progress update separately to ensure type safety
    const progressUpdate = params.progress ? {
      ...task.progress,
      ...params.progress,
      completionPercentage: params.progress.completionPercentage ?? task.progress.completionPercentage,
    } : task.progress;

    const updatedTask: Task = {
      ...task,
      ...params,
      progress: progressUpdate,
      updatedAt: new Date(),
    };

    // Update completion timestamp if status changed to completed
    if (params.status === TaskStatus.COMPLETED && task.status !== TaskStatus.COMPLETED) {
      updatedTask.completedAt = new Date();
    }

    // Update start timestamp if status changed from not started
    if (params.status && params.status !== TaskStatus.NOT_STARTED && task.status === TaskStatus.NOT_STARTED) {
      updatedTask.startedAt = new Date();
    }

    await this.saveTask(updatedTask);
    return updatedTask;
  }

  /**
   * Query tasks with filtering
   */
  async queryTasks(query: TaskQuery = {}): Promise<Task[]> {
    try {
      const files = await fs.readdir(this.tasksDir);
      const taskFiles = files.filter(file => file.endsWith('.json'));
      
      const tasks: Task[] = [];
      
      for (const file of taskFiles) {
        try {
          const taskId = path.basename(file, '.json');
          const task = await this.loadTask(taskId);
          
          if (task && this.taskMatchesQuery(task, query)) {
            tasks.push(task);
          }
        } catch (error) {
          console.warn(`Failed to load task from ${file}:`, error);
        }
      }
      
      // Apply sorting and pagination
      tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      if (query.offset) {
        tasks.splice(0, query.offset);
      }
      
      if (query.limit) {
        tasks.splice(query.limit);
      }
      
      return tasks;
    } catch (error) {
      throw new StorageError(
        'Failed to query tasks',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get next task in sequence for an orchestration
   */
  async getNextTask(orchestrationId: string): Promise<Task | null> {
    const tasks = await this.queryTasks({
      orchestrationId,
      status: TaskStatus.NOT_STARTED,
    });

    if (tasks.length === 0) return null;

    // Sort by dependencies and priority
    tasks.sort((a, b) => {
      // Tasks with no dependencies come first
      if (a.dependencies.length === 0 && b.dependencies.length > 0) return -1;
      if (a.dependencies.length > 0 && b.dependencies.length === 0) return 1;
      
      // Then by priority
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return tasks[0];
  }

  /**
   * Check if task matches query criteria
   */
  private taskMatchesQuery(task: Task, query: TaskQuery): boolean {
    if (query.orchestrationId && task.orchestrationId !== query.orchestrationId) {
      return false;
    }
    
    if (query.status && task.status !== query.status) {
      return false;
    }
    
    if (query.priority && task.priority !== query.priority) {
      return false;
    }
    
    if (query.parentTaskId && task.parentTaskId !== query.parentTaskId) {
      return false;
    }
    
    if (query.assignee && task.assignee !== query.assignee) {
      return false;
    }
    
    if (query.tags && query.tags.length > 0) {
      if (!query.tags.some(tag => task.tags?.includes(tag))) {
        return false;
      }
    }
    
    if (query.dateRange) {
      const taskDate = task.createdAt;
      if (query.dateRange.from && taskDate < query.dateRange.from) {
        return false;
      }
      if (query.dateRange.to && taskDate > query.dateRange.to) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get task dependency graph
   */
  async getTaskDependencyGraph(orchestrationId: string): Promise<{
    nodes: Array<{ id: string; name: string; status: TaskStatus; level: number }>;
    edges: Array<{ from: string; to: string; type: DependencyType }>;
  }> {
    const tasks = await this.queryTasks({ orchestrationId });

    const nodes = tasks.map(task => ({
      id: task.id,
      name: task.name,
      status: task.status,
      level: 0, // Will be calculated
    }));

    const edges: Array<{ from: string; to: string; type: DependencyType }> = [];

    for (const task of tasks) {
      for (const dependency of task.dependencies) {
        edges.push({
          from: dependency.taskId,
          to: task.id,
          type: dependency.type,
        });
      }
    }

    // Calculate levels (topological sort)
    this.calculateTaskLevels(nodes, edges);

    return { nodes, edges };
  }

  /**
   * Get task execution order
   */
  async getTaskExecutionOrder(orchestrationId: string): Promise<Task[]> {
    const tasks = await this.queryTasks({ orchestrationId });

    // Create dependency map
    const dependencyMap = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize
    for (const task of tasks) {
      dependencyMap.set(task.id, []);
      inDegree.set(task.id, 0);
    }

    // Build dependency graph
    for (const task of tasks) {
      for (const dependency of task.dependencies) {
        if (dependencyMap.has(dependency.taskId)) {
          dependencyMap.get(dependency.taskId)!.push(task.id);
          inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
        }
      }
    }

    // Topological sort
    const queue: string[] = [];
    const result: Task[] = [];

    // Find tasks with no dependencies
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    while (queue.length > 0) {
      const currentTaskId = queue.shift()!;
      const currentTask = tasks.find(t => t.id === currentTaskId);

      if (currentTask) {
        result.push(currentTask);
      }

      // Process dependent tasks
      const dependents = dependencyMap.get(currentTaskId) || [];
      for (const dependentId of dependents) {
        const newDegree = (inDegree.get(dependentId) || 0) - 1;
        inDegree.set(dependentId, newDegree);

        if (newDegree === 0) {
          queue.push(dependentId);
        }
      }
    }

    return result;
  }

  /**
   * Validate task dependencies for cycles
   */
  async validateTaskDependencies(orchestrationId: string): Promise<{
    isValid: boolean;
    cycles: string[][];
    orphanedTasks: string[];
    invalidDependencies: string[];
  }> {
    const tasks = await this.queryTasks({ orchestrationId });
    const taskIds = new Set(tasks.map(t => t.id));

    const result = {
      isValid: true,
      cycles: [] as string[][],
      orphanedTasks: [] as string[],
      invalidDependencies: [] as string[],
    };

    // Check for invalid dependencies
    for (const task of tasks) {
      for (const dependency of task.dependencies) {
        if (!taskIds.has(dependency.taskId)) {
          result.invalidDependencies.push(`${task.id} -> ${dependency.taskId}`);
          result.isValid = false;
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
        result.cycles.push(path.slice(cycleStart).concat(taskId));
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      recursionStack.add(taskId);

      const task = tasks.find(t => t.id === taskId);
      if (task) {
        for (const dependency of task.dependencies) {
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
        if (hasCycle(task.id, [])) {
          result.isValid = false;
        }
      }
    }

    return result;
  }

  /**
   * Get task statistics
   */
  async getTaskStatistics(orchestrationId: string): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
    completionPercentage: number;
    averageProgress: number;
    estimatedTotalHours: number;
    actualTotalHours: number;
  }> {
    const tasks = await this.queryTasks({ orchestrationId });

    const stats = {
      total: tasks.length,
      byStatus: {
        [TaskStatus.NOT_STARTED]: 0,
        [TaskStatus.IN_PROGRESS]: 0,
        [TaskStatus.COMPLETED]: 0,
        [TaskStatus.BLOCKED]: 0,
        [TaskStatus.CANCELLED]: 0,
        [TaskStatus.FAILED]: 0,
      },
      byPriority: {
        [TaskPriority.LOW]: 0,
        [TaskPriority.MEDIUM]: 0,
        [TaskPriority.HIGH]: 0,
        [TaskPriority.CRITICAL]: 0,
      },
      completionPercentage: 0,
      averageProgress: 0,
      estimatedTotalHours: 0,
      actualTotalHours: 0,
    };

    let totalProgress = 0;

    for (const task of tasks) {
      stats.byStatus[task.status]++;
      stats.byPriority[task.priority]++;
      totalProgress += task.progress.completionPercentage;

      if (task.estimation?.effortHours) {
        stats.estimatedTotalHours += task.estimation.effortHours;
      }
    }

    stats.completionPercentage = Math.round((stats.byStatus[TaskStatus.COMPLETED] / tasks.length) * 100);
    stats.averageProgress = tasks.length > 0 ? Math.round(totalProgress / tasks.length) : 0;

    return stats;
  }

  /**
   * Export task manifest to different formats
   */
  async exportTaskManifest(orchestrationId: string, format: 'json' | 'csv' | 'markdown'): Promise<string> {
    const tasks = await this.queryTasks({ orchestrationId });
    const plan = await this.loadPlan(orchestrationId); // Assuming plan ID matches orchestration ID

    switch (format) {
      case 'json':
        return JSON.stringify({
          orchestrationId,
          plan,
          tasks,
          exportedAt: new Date().toISOString(),
        }, null, 2);

      case 'csv':
        const csvHeaders = 'ID,Name,Description,Status,Priority,Progress,Estimated Hours,Created At';
        const csvRows = tasks.map(task => [
          task.id,
          `"${task.name}"`,
          `"${task.description}"`,
          task.status,
          task.priority,
          task.progress.completionPercentage,
          task.estimation?.effortHours || 0,
          task.createdAt.toISOString(),
        ].join(','));
        return [csvHeaders, ...csvRows].join('\n');

      case 'markdown':
        const mdLines = [
          `# Task Manifest - ${plan?.name || orchestrationId}`,
          '',
          plan?.description ? `${plan.description}` : '',
          '',
          '## Tasks',
          '',
          '| Name | Status | Priority | Progress | Estimated Hours |',
          '|------|--------|----------|----------|-----------------|',
          ...tasks.map(task =>
            `| ${task.name} | ${task.status} | ${task.priority} | ${task.progress.completionPercentage}% | ${task.estimation?.effortHours || 'N/A'} |`
          ),
          '',
          '## Statistics',
          '',
        ];

        const stats = await this.getTaskStatistics(orchestrationId);
        mdLines.push(`- Total Tasks: ${stats.total}`);
        mdLines.push(`- Completed: ${stats.byStatus[TaskStatus.COMPLETED]} (${stats.completionPercentage}%)`);
        mdLines.push(`- In Progress: ${stats.byStatus[TaskStatus.IN_PROGRESS]}`);
        mdLines.push(`- Not Started: ${stats.byStatus[TaskStatus.NOT_STARTED]}`);
        mdLines.push(`- Average Progress: ${stats.averageProgress}%`);

        return mdLines.join('\n');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Calculate task levels for dependency graph
   */
  private calculateTaskLevels(
    nodes: Array<{ id: string; name: string; status: TaskStatus; level: number }>,
    edges: Array<{ from: string; to: string; type: DependencyType }>
  ): void {
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    // Initialize
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      dependents.set(node.id, []);
    }

    // Build graph
    for (const edge of edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      dependents.get(edge.from)?.push(edge.to);
    }

    // Level assignment using topological sort
    const queue: string[] = [];

    // Start with nodes that have no dependencies
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
        nodeMap.get(nodeId)!.level = 0;
      }
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = nodeMap.get(currentId)!;

      const dependentIds = dependents.get(currentId) || [];
      for (const dependentId of dependentIds) {
        const newDegree = (inDegree.get(dependentId) || 0) - 1;
        inDegree.set(dependentId, newDegree);

        const dependentNode = nodeMap.get(dependentId)!;
        dependentNode.level = Math.max(dependentNode.level, currentNode.level + 1);

        if (newDegree === 0) {
          queue.push(dependentId);
        }
      }
    }
  }

  /**
   * Generate unique identifier
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate unique task identifier
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
