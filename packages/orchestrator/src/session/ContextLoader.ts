/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content } from '@google/genai';
import { 
  OrchestrationSession,
  SessionType,
  SessionContext,
  SessionArtifact,
  SessionDecision,
} from '../types/session.js';
import { Task } from '../types/task.js';
import { DevelopmentPlan } from '../types/planning.js';
import { SessionRegistry } from './SessionRegistry.js';
import { TaskManifest } from '../state/TaskManifest.js';

/**
 * Context loading options
 */
export interface ContextLoadingOptions {
  /** Include conversation messages */
  includeMessages: boolean;
  /** Include session artifacts */
  includeArtifacts: boolean;
  /** Include session decisions */
  includeDecisions: boolean;
  /** Include sequential thinking data */
  includeThinking: boolean;
  /** Maximum number of messages to load */
  maxMessages?: number;
  /** Message types to include */
  messageTypes?: string[];
  /** Artifact types to include */
  artifactTypes?: string[];
  /** Time range for context */
  timeRange?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * Context summary for efficient loading
 */
export interface ContextSummary {
  sessionId: string;
  sessionType: SessionType;
  focus: string;
  keyDecisions: string[];
  importantArtifacts: string[];
  lastActivity: Date;
  messageCount: number;
  artifactCount: number;
  decisionCount: number;
}

/**
 * Loaded context result
 */
export interface LoadedContext {
  summary: ContextSummary;
  messages: Content[];
  artifacts: SessionArtifact[];
  decisions: SessionDecision[];
  relatedTasks?: Task[];
  relatedPlan?: DevelopmentPlan;
  parentContext?: ContextSummary;
  childContexts?: ContextSummary[];
}

/**
 * Context loader for selective session context loading
 */
export class ContextLoader {
  private sessionRegistry: SessionRegistry;
  private taskManifest: TaskManifest;

  constructor(sessionRegistry: SessionRegistry, taskManifest: TaskManifest) {
    this.sessionRegistry = sessionRegistry;
    this.taskManifest = taskManifest;
  }

  /**
   * Load context for a session based on its type and purpose
   */
  async loadSessionContext(
    sessionId: string, 
    purpose: 'resume' | 'reference' | 'verification' | 'planning',
    customOptions?: Partial<ContextLoadingOptions>
  ): Promise<LoadedContext | null> {
    const session = await this.sessionRegistry.getSession(sessionId);
    if (!session) return null;

    // Get default options based on session type and purpose
    const options = this.getContextOptions(session.type, purpose, customOptions);
    
    // Load base context
    const context = await this.loadBaseContext(session, options);
    
    // Load related data based on session type
    const relatedData = await this.loadRelatedData(session, options);
    
    // Load hierarchical context if needed
    const hierarchicalContext = await this.loadHierarchicalContext(session, options);
    
    return {
      ...context,
      ...relatedData,
      ...hierarchicalContext,
    };
  }

  /**
   * Load context for planning session
   */
  async loadPlanningContext(
    orchestrationId: string,
    includeHistory: boolean = false
  ): Promise<LoadedContext | null> {
    const sessions = await this.sessionRegistry.querySessions({
      orchestrationId,
      type: SessionType.PLANNING,
    });

    if (sessions.length === 0) return null;

    // Get the most recent planning session
    const planningSession = sessions.sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    )[0];

    const options: ContextLoadingOptions = {
      includeMessages: includeHistory,
      includeArtifacts: true,
      includeDecisions: true,
      includeThinking: true,
      maxMessages: includeHistory ? 50 : 0,
    };

    return this.loadBaseContext(planningSession, options);
  }

  /**
   * Load context for task implementation
   */
  async loadTaskContext(
    taskId: string,
    includeParentContext: boolean = true
  ): Promise<LoadedContext | null> {
    const task = await this.taskManifest.loadTask(taskId);
    if (!task) return null;

    // Find task session
    const sessions = await this.sessionRegistry.querySessions({
      orchestrationId: task.orchestrationId,
      type: SessionType.TASK,
      taskId,
    });

    const taskSession = sessions[0];
    if (!taskSession) return null;

    const options: ContextLoadingOptions = {
      includeMessages: false, // Fresh session for task implementation
      includeArtifacts: true,
      includeDecisions: true,
      includeThinking: false,
      artifactTypes: ['task_specification', 'acceptance_criteria', 'dependencies'],
    };

    const context = await this.loadBaseContext(taskSession, options);
    
    // Add task-specific data
    context.relatedTasks = [task];
    
    // Load parent planning context if requested
    if (includeParentContext) {
      const planningContext = await this.loadPlanningContext(task.orchestrationId, false);
      if (planningContext) {
        context.parentContext = planningContext.summary;
        // Include key planning artifacts
        context.artifacts.push(...planningContext.artifacts.filter(a => 
          a.type === 'plan' || a.type === 'requirement' || a.type === 'architecture_decision'
        ));
      }
    }

    return context;
  }

  /**
   * Load context for verification
   */
  async loadVerificationContext(
    orchestrationId: string,
    includeAllSessions: boolean = false
  ): Promise<LoadedContext | null> {
    const options: ContextLoadingOptions = {
      includeMessages: false, // Fresh verification session
      includeArtifacts: true,
      includeDecisions: true,
      includeThinking: false,
      artifactTypes: ['test_result', 'completion_criteria', 'quality_metric'],
    };

    // Get all sessions for the orchestration
    const allSessions = await this.sessionRegistry.querySessions({ orchestrationId });
    
    if (allSessions.length === 0) return null;

    // Create summary context from all sessions
    const summary: ContextSummary = {
      sessionId: 'verification-context',
      sessionType: SessionType.VERIFICATION,
      focus: 'Project completion verification',
      keyDecisions: [],
      importantArtifacts: [],
      lastActivity: new Date(),
      messageCount: 0,
      artifactCount: 0,
      decisionCount: 0,
    };

    const artifacts: SessionArtifact[] = [];
    const decisions: SessionDecision[] = [];
    const childContexts: ContextSummary[] = [];

    for (const session of allSessions) {
      // Add session summary to child contexts
      childContexts.push({
        sessionId: session.id,
        sessionType: session.type,
        focus: session.context.currentFocus,
        keyDecisions: session.context.decisions.map(d => d.description),
        importantArtifacts: session.context.artifacts.map(a => a.name),
        lastActivity: session.lastActivityAt,
        messageCount: session.context.messages.length,
        artifactCount: session.context.artifacts.length,
        decisionCount: session.context.decisions.length,
      });

      // Collect important artifacts and decisions
      artifacts.push(...session.context.artifacts.filter(a => 
        a.type === 'deliverable' || a.type === 'test_result' || a.type === 'completion_proof'
      ));

      decisions.push(...session.context.decisions.filter(d => 
        d.description.includes('complete') || d.description.includes('approve')
      ));
    }

    // Load related tasks
    const relatedTasks = await this.taskManifest.queryTasks({ orchestrationId });

    return {
      summary,
      messages: [],
      artifacts,
      decisions,
      relatedTasks,
      childContexts,
    };
  }

  /**
   * Create context summary for efficient reference
   */
  async createContextSummary(sessionId: string): Promise<ContextSummary | null> {
    const session = await this.sessionRegistry.getSession(sessionId);
    if (!session) return null;

    return {
      sessionId: session.id,
      sessionType: session.type,
      focus: session.context.currentFocus,
      keyDecisions: session.context.decisions
        .slice(-5) // Last 5 decisions
        .map(d => d.description),
      importantArtifacts: session.context.artifacts
        .filter(a => a.type === 'deliverable' || a.type === 'plan' || a.type === 'requirement')
        .map(a => a.name),
      lastActivity: session.lastActivityAt,
      messageCount: session.context.messages.length,
      artifactCount: session.context.artifacts.length,
      decisionCount: session.context.decisions.length,
    };
  }

  /**
   * Get context loading options based on session type and purpose
   */
  private getContextOptions(
    sessionType: SessionType,
    purpose: string,
    customOptions?: Partial<ContextLoadingOptions>
  ): ContextLoadingOptions {
    let defaultOptions: ContextLoadingOptions;

    switch (sessionType) {
      case SessionType.PLANNING:
        defaultOptions = {
          includeMessages: purpose === 'resume',
          includeArtifacts: true,
          includeDecisions: true,
          includeThinking: true,
          maxMessages: purpose === 'resume' ? 100 : 10,
          artifactTypes: ['requirement', 'plan', 'architecture_decision'],
        };
        break;

      case SessionType.TASK:
        defaultOptions = {
          includeMessages: purpose === 'resume',
          includeArtifacts: true,
          includeDecisions: true,
          includeThinking: purpose === 'resume',
          maxMessages: purpose === 'resume' ? 50 : 5,
          artifactTypes: ['task_specification', 'implementation', 'test'],
        };
        break;

      case SessionType.VERIFICATION:
        defaultOptions = {
          includeMessages: false,
          includeArtifacts: true,
          includeDecisions: true,
          includeThinking: false,
          artifactTypes: ['test_result', 'completion_criteria', 'quality_metric'],
        };
        break;

      case SessionType.INTERACTIVE:
        defaultOptions = {
          includeMessages: purpose === 'resume',
          includeArtifacts: true,
          includeDecisions: false,
          includeThinking: false,
          maxMessages: purpose === 'resume' ? 20 : 0,
        };
        break;

      default:
        defaultOptions = {
          includeMessages: false,
          includeArtifacts: true,
          includeDecisions: true,
          includeThinking: false,
        };
    }

    return { ...defaultOptions, ...customOptions };
  }

  /**
   * Load base context from session
   */
  private async loadBaseContext(
    session: OrchestrationSession,
    options: ContextLoadingOptions
  ): Promise<LoadedContext> {
    const summary = await this.createContextSummary(session.id);
    
    let messages: Content[] = [];
    let artifacts: SessionArtifact[] = [];
    let decisions: SessionDecision[] = [];

    if (options.includeMessages) {
      messages = session.context.messages.slice(-(options.maxMessages || 50));
    }

    if (options.includeArtifacts) {
      artifacts = session.context.artifacts.filter(artifact => 
        !options.artifactTypes || options.artifactTypes.includes(artifact.type)
      );
    }

    if (options.includeDecisions) {
      decisions = session.context.decisions;
    }

    // Apply time range filter if specified
    if (options.timeRange) {
      if (options.timeRange.from) {
        artifacts = artifacts.filter(a => a.createdAt >= options.timeRange!.from!);
        decisions = decisions.filter(d => d.timestamp >= options.timeRange!.from!);
      }
      if (options.timeRange.to) {
        artifacts = artifacts.filter(a => a.createdAt <= options.timeRange!.to!);
        decisions = decisions.filter(d => d.timestamp <= options.timeRange!.to!);
      }
    }

    return {
      summary: summary!,
      messages,
      artifacts,
      decisions,
    };
  }

  /**
   * Load related data based on session type
   */
  private async loadRelatedData(
    session: OrchestrationSession,
    options: ContextLoadingOptions
  ): Promise<Partial<LoadedContext>> {
    const result: Partial<LoadedContext> = {};

    // Load related tasks
    if (session.taskId) {
      const task = await this.taskManifest.loadTask(session.taskId);
      if (task) {
        result.relatedTasks = [task];
      }
    } else if (session.type === SessionType.PLANNING || session.type === SessionType.VERIFICATION) {
      const tasks = await this.taskManifest.queryTasks({
        orchestrationId: session.orchestrationId,
      });
      result.relatedTasks = tasks;
    }

    // Load related plan
    if (session.type === SessionType.PLANNING) {
      const plans = await this.taskManifest.queryTasks({
        orchestrationId: session.orchestrationId,
      });
      // In a real implementation, you'd have a separate plan query method
      // For now, we'll leave this as undefined
    }

    return result;
  }

  /**
   * Load hierarchical context (parent/child relationships)
   */
  private async loadHierarchicalContext(
    session: OrchestrationSession,
    options: ContextLoadingOptions
  ): Promise<Partial<LoadedContext>> {
    const result: Partial<LoadedContext> = {};

    // Load parent context summary
    if (session.parentSessionId) {
      const parentSummary = await this.createContextSummary(session.parentSessionId);
      result.parentContext = parentSummary || undefined;
    }

    // Load child context summaries
    if (session.childSessionIds && session.childSessionIds.length > 0) {
      const childContexts: ContextSummary[] = [];
      for (const childId of session.childSessionIds) {
        const childSummary = await this.createContextSummary(childId);
        if (childSummary) {
          childContexts.push(childSummary);
        }
      }
      result.childContexts = childContexts;
    }

    return result;
  }
}
