/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config, ToolRegistry } from '@qwen-code/qwen-code-core';
import { SequentialThinkingTool } from './SequentialThinkingTool.js';
import { SessionRegistry } from '../session/SessionRegistry.js';
import { OrchestrationSession } from '../session/OrchestrationSession.js';
import { SessionType, ThinkingSession } from '../types/session.js';

/**
 * Thinking tool integration configuration
 */
export interface ThinkingIntegrationConfig {
  /** Whether to automatically register the thinking tool */
  autoRegister: boolean;
  /** Whether thinking is mandatory for planning sessions */
  mandatoryForPlanning: boolean;
  /** Whether to preserve thinking sessions across orchestration sessions */
  preserveThinkingSessions: boolean;
  /** Maximum thinking steps before warning */
  maxThinkingSteps?: number;
  /** Thinking timeout in milliseconds */
  thinkingTimeout?: number;
}

/**
 * Thinking tool integration manager
 */
export class ThinkingToolIntegration {
  private config: Config;
  private toolRegistry: ToolRegistry;
  private sessionRegistry: SessionRegistry;
  private thinkingTool: SequentialThinkingTool;
  private integrationConfig: ThinkingIntegrationConfig;

  /**
   * Safely convert a value to Date, handling unknown types
   */
  private safeToDate(value: unknown, fallback: Date | number = 0): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    return new Date(fallback);
  }

  constructor(
    config: Config,
    toolRegistry: ToolRegistry,
    sessionRegistry: SessionRegistry,
    integrationConfig: ThinkingIntegrationConfig = {
      autoRegister: true,
      mandatoryForPlanning: true,
      preserveThinkingSessions: true,
      maxThinkingSteps: 50,
      thinkingTimeout: 30 * 60 * 1000, // 30 minutes
    }
  ) {
    this.config = config;
    this.toolRegistry = toolRegistry;
    this.sessionRegistry = sessionRegistry;
    this.integrationConfig = integrationConfig;
    this.thinkingTool = new SequentialThinkingTool();
  }

  /**
   * Initialize thinking tool integration
   */
  async initialize(): Promise<void> {
    if (this.integrationConfig.autoRegister) {
      await this.registerThinkingTool();
    }

    // Set up session event listeners
    this.setupSessionEventListeners();
  }

  /**
   * Register the sequential thinking tool with the tool registry
   */
  async registerThinkingTool(): Promise<void> {
    try {
      this.toolRegistry.registerTool(this.thinkingTool);
      console.log('Sequential thinking tool registered successfully');
    } catch (error) {
      console.error('Failed to register sequential thinking tool:', error);
      throw error;
    }
  }

  /**
   * Start thinking session for orchestration session
   */
  async startThinkingForSession(
    orchestrationSessionId: string,
    purpose: string = 'structured_reasoning',
    metadata?: Record<string, unknown>
  ): Promise<ThinkingSession> {
    const orchestrationSession = await this.sessionRegistry.getSession(orchestrationSessionId);
    if (!orchestrationSession) {
      throw new Error(`Orchestration session ${orchestrationSessionId} not found`);
    }

    // Start new thinking session in the tool
    const thinkingSession = this.thinkingTool.startNewSession();
    
    // Update thinking session metadata
    thinkingSession.metadata = {
      ...thinkingSession.metadata,
      purpose,
      orchestrationSessionId,
      sessionType: orchestrationSession.type,
      ...metadata,
    };

    // Link thinking session to orchestration session
    orchestrationSession.startThinking(thinkingSession.metadata);
    
    // Save orchestration session with thinking session
    await this.sessionRegistry.updateSession(orchestrationSessionId, {});

    return thinkingSession;
  }

  /**
   * Check if thinking is required for session type
   */
  isThinkingRequired(sessionType: SessionType): boolean {
    if (this.integrationConfig.mandatoryForPlanning && sessionType === SessionType.PLANNING) {
      return true;
    }
    
    // Add other mandatory thinking scenarios here
    return false;
  }

  /**
   * Validate thinking session before proceeding
   */
  async validateThinkingSession(
    orchestrationSessionId: string,
    requiredPurpose?: string
  ): Promise<{
    isValid: boolean;
    hasThinking: boolean;
    isComplete: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      isValid: true,
      hasThinking: false,
      isComplete: false,
      errors: [] as string[],
      warnings: [] as string[],
    };

    const orchestrationSession = await this.sessionRegistry.getSession(orchestrationSessionId);
    if (!orchestrationSession) {
      result.errors.push(`Orchestration session ${orchestrationSessionId} not found`);
      result.isValid = false;
      return result;
    }

    // Check if thinking is required
    const thinkingRequired = this.isThinkingRequired(orchestrationSession.type);
    
    // Check if thinking session exists
    const thinkingSession = orchestrationSession.context.sequentialThinking;
    result.hasThinking = !!thinkingSession;

    if (thinkingRequired && !result.hasThinking) {
      result.errors.push(`Thinking is required for ${orchestrationSession.type} sessions`);
      result.isValid = false;
      return result;
    }

    if (result.hasThinking && thinkingSession) {
      // Validate thinking session completeness
      result.isComplete = thinkingSession.state === 'completed';
      
      if (thinkingRequired && !result.isComplete) {
        result.errors.push('Thinking session must be completed before proceeding');
        result.isValid = false;
      }

      // Check thinking session purpose
      if (requiredPurpose && thinkingSession.metadata?.purpose !== requiredPurpose) {
        result.warnings.push(`Thinking session purpose is '${thinkingSession.metadata?.purpose}', expected '${requiredPurpose}'`);
      }

      // Check thinking session quality
      if (thinkingSession.steps.length === 0) {
        result.errors.push('Thinking session has no steps');
        result.isValid = false;
      } else if (thinkingSession.steps.length < 3) {
        result.warnings.push('Thinking session has very few steps, consider more thorough analysis');
      }

      // Check for excessive thinking
      if (this.integrationConfig.maxThinkingSteps && 
          thinkingSession.steps.length > this.integrationConfig.maxThinkingSteps) {
        result.warnings.push(`Thinking session has ${thinkingSession.steps.length} steps, which exceeds recommended maximum of ${this.integrationConfig.maxThinkingSteps}`);
      }
    }

    return result;
  }

  /**
   * Get thinking session summary for orchestration session
   */
  async getThinkingSummary(orchestrationSessionId: string): Promise<{
    hasThinking: boolean;
    thinkingId?: string;
    stepCount: number;
    isComplete: boolean;
    purpose?: string;
    duration?: string;
    keyInsights: string[];
  }> {
    const orchestrationSession = await this.sessionRegistry.getSession(orchestrationSessionId);
    if (!orchestrationSession) {
      throw new Error(`Orchestration session ${orchestrationSessionId} not found`);
    }

    const thinkingSession = orchestrationSession.context.sequentialThinking;
    
    if (!thinkingSession) {
      return {
        hasThinking: false,
        stepCount: 0,
        isComplete: false,
        keyInsights: [],
      };
    }

    // Extract key insights from thinking steps
    const keyInsights = thinkingSession.steps
      .filter(step => step.thought.length > 100) // Longer thoughts likely contain insights
      .slice(-5) // Last 5 significant thoughts
      .map(step => step.thought.substring(0, 200) + (step.thought.length > 200 ? '...' : ''));

    // Calculate duration
    let duration: string | undefined;
    if (thinkingSession.metadata?.startTime) {
      const startTime = this.safeToDate(thinkingSession.metadata.startTime);
      const endTime = thinkingSession.metadata?.endTime ?
        this.safeToDate(thinkingSession.metadata.endTime) : new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }

    return {
      hasThinking: true,
      thinkingId: thinkingSession.id,
      stepCount: thinkingSession.steps.length,
      isComplete: thinkingSession.state === 'completed',
      purpose: thinkingSession.metadata?.purpose as string,
      duration,
      keyInsights,
    };
  }

  /**
   * Force thinking completion for session
   */
  async completeThinking(orchestrationSessionId: string): Promise<void> {
    const orchestrationSession = await this.sessionRegistry.getSession(orchestrationSessionId);
    if (!orchestrationSession) {
      throw new Error(`Orchestration session ${orchestrationSessionId} not found`);
    }

    const thinkingSession = orchestrationSession.context.sequentialThinking;
    if (!thinkingSession) {
      throw new Error('No active thinking session found');
    }

    // Complete thinking in orchestration session
    orchestrationSession.completeThinking();
    
    // Complete thinking in tool
    const toolThinkingSession = this.thinkingTool.getSession(thinkingSession.id);
    if (toolThinkingSession) {
      toolThinkingSession.state = 'completed';
      if (!toolThinkingSession.metadata) {
        toolThinkingSession.metadata = {};
      }
      toolThinkingSession.metadata.endTime = new Date().toISOString();
    }

    // Save changes
    await this.sessionRegistry.updateSession(orchestrationSessionId, {});
  }

  /**
   * Get thinking tool statistics
   */
  getThinkingStatistics(): {
    toolStats: any;
    integrationStats: {
      sessionsWithThinking: number;
      completedThinkingSessions: number;
      averageThinkingSteps: number;
    };
  } {
    const toolStats = this.thinkingTool.getStatistics();
    
    // Calculate integration-specific statistics
    const allSessions = this.thinkingTool.getAllSessions();
    const sessionsWithOrchestration = allSessions.filter(s => 
      s.metadata?.orchestrationSessionId
    );
    
    const completedSessions = sessionsWithOrchestration.filter(s => 
      s.state === 'completed'
    );
    
    const averageSteps = sessionsWithOrchestration.length > 0 ?
      sessionsWithOrchestration.reduce((sum, s) => sum + s.steps.length, 0) / sessionsWithOrchestration.length :
      0;

    return {
      toolStats,
      integrationStats: {
        sessionsWithThinking: sessionsWithOrchestration.length,
        completedThinkingSessions: completedSessions.length,
        averageThinkingSteps: averageSteps,
      },
    };
  }

  /**
   * Setup session event listeners
   */
  private setupSessionEventListeners(): void {
    this.sessionRegistry.addEventListener((event) => {
      if (event.type === 'session_created') {
        this.handleSessionCreated(event.sessionId);
      } else if (event.type === 'session_state_changed') {
        this.handleSessionStateChanged(event.sessionId, event.data);
      }
    });
  }

  /**
   * Handle session creation
   */
  private async handleSessionCreated(sessionId: string): Promise<void> {
    try {
      const session = await this.sessionRegistry.getSession(sessionId);
      if (!session) return;

      // Auto-start thinking for sessions that require it
      if (this.isThinkingRequired(session.type)) {
        await this.startThinkingForSession(
          sessionId,
          `${session.type}_analysis`,
          { autoStarted: true }
        );
      }
    } catch (error) {
      console.warn(`Failed to auto-start thinking for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle session state changes
   */
  private async handleSessionStateChanged(sessionId: string, data: any): Promise<void> {
    try {
      const session = await this.sessionRegistry.getSession(sessionId);
      if (!session) return;

      // If session is being completed, ensure thinking is also completed
      if (data.newState === 'completed' && session.context.sequentialThinking) {
        const thinkingSession = session.context.sequentialThinking;
        if (thinkingSession.state === 'active') {
          await this.completeThinking(sessionId);
        }
      }
    } catch (error) {
      console.warn(`Failed to handle session state change for ${sessionId}:`, error);
    }
  }

  /**
   * Get the thinking tool instance
   */
  getThinkingTool(): SequentialThinkingTool {
    return this.thinkingTool;
  }

  /**
   * Update integration configuration
   */
  updateConfig(newConfig: Partial<ThinkingIntegrationConfig>): void {
    this.integrationConfig = { ...this.integrationConfig, ...newConfig };
  }
}
