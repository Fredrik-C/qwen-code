/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult, Icon } from '@qwen-code/qwen-code-core';
import { Type, FunctionDeclaration, Schema } from '@google/genai';
import { z } from 'zod';
import { ThinkingSession, ThinkingStep } from '../types/session.js';

/**
 * Sequential thinking step parameters
 */
const ThinkingStepSchema = z.object({
  thought: z.string().describe('Your current thinking step'),
  nextThoughtNeeded: z.boolean().describe('Whether another thought step is needed'),
  thoughtNumber: z.number().min(1).describe('Current thought number'),
  totalThoughts: z.number().min(1).describe('Estimated total thoughts needed'),
  isRevision: z.boolean().optional().describe('Whether this revises previous thinking'),
  revisesThought: z.number().optional().describe('Which thought is being reconsidered'),
  branchFromThought: z.number().optional().describe('Branching point thought number'),
  branchId: z.string().optional().describe('Branch identifier'),
  needsMoreThoughts: z.boolean().optional().describe('If more thoughts are needed'),
});

type ThinkingStepParams = z.infer<typeof ThinkingStepSchema>;

/**
 * Sequential thinking tool for structured reasoning
 */
export class SequentialThinkingTool extends BaseTool {
  private currentSession: ThinkingSession | null = null;
  private sessionHistory: Map<string, ThinkingSession> = new Map();

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

  constructor() {
    const parameterSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        thought: {
          type: Type.STRING,
          description: 'Your current thinking step, which can include regular analytical steps, revisions, questions, realizations, changes in approach, hypothesis generation, or verification',
        },
        nextThoughtNeeded: {
          type: Type.BOOLEAN,
          description: 'True if you need more thinking, even if at what seemed like the end',
        },
        thoughtNumber: {
          type: Type.NUMBER,
          description: 'Current number in sequence (can go beyond initial total if needed)',
        },
        totalThoughts: {
          type: Type.NUMBER,
          description: 'Current estimate of thoughts needed (can be adjusted up/down)',
        },
        isRevision: {
          type: Type.BOOLEAN,
          description: 'Whether this revises previous thinking',
        },
        revisesThought: {
          type: Type.NUMBER,
          description: 'Which thought is being reconsidered',
        },
        branchFromThought: {
          type: Type.NUMBER,
          description: 'Branching point thought number',
        },
        branchId: {
          type: Type.STRING,
          description: 'Branch identifier',
        },
        needsMoreThoughts: {
          type: Type.BOOLEAN,
          description: 'If more thoughts are needed',
        },
      },
      required: ['thought', 'nextThoughtNeeded', 'thoughtNumber', 'totalThoughts'],
    };

    super(
      'sequentialthinking',
      'Sequential Thinking',
      'A tool for dynamic and reflective problem-solving through structured thoughts',
      Icon.LightBulb,
      parameterSchema,
      true, // isOutputMarkdown
      false // canUpdateOutput
    );
  }



  async execute(
    params: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    try {
      // Validate parameters
      const validatedParams = ThinkingStepSchema.parse(params);
      
      // Initialize session if needed
      if (!this.currentSession) {
        this.currentSession = this.createThinkingSession();
      }

      // Add thinking step
      const step = this.addThinkingStep(validatedParams);
      
      // Update session state
      this.updateSessionState(validatedParams);
      
      // Generate response
      const response = this.generateResponse(step, validatedParams);
      
      return {
        llmContent: response.llmContent,
        returnDisplay: response.returnDisplay,
      };
      
    } catch (error) {
      return {
        llmContent: `Sequential thinking error: ${error instanceof Error ? error.message : String(error)}`,
        returnDisplay: `❌ Sequential thinking failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Create a new thinking session
   */
  private createThinkingSession(): ThinkingSession {
    const sessionId = `thinking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: ThinkingSession = {
      id: sessionId,
      steps: [],
      currentStep: 0,
      totalSteps: 1,
      state: 'active',
      metadata: {
        startTime: new Date().toISOString(),
        purpose: 'structured_reasoning',
      },
    };

    this.sessionHistory.set(sessionId, session);
    return session;
  }

  /**
   * Add a thinking step to the current session
   */
  private addThinkingStep(params: ThinkingStepParams): ThinkingStep {
    if (!this.currentSession) {
      throw new Error('No active thinking session');
    }

    const step: ThinkingStep = {
      stepNumber: params.thoughtNumber,
      thought: params.thought,
      nextThoughtNeeded: params.nextThoughtNeeded,
      isRevision: params.isRevision,
      revisesThought: params.revisesThought,
      branchFromThought: params.branchFromThought,
      branchId: params.branchId,
      needsMoreThoughts: params.needsMoreThoughts,
      timestamp: new Date(),
    };

    this.currentSession.steps.push(step);
    this.currentSession.currentStep = params.thoughtNumber;
    this.currentSession.totalSteps = Math.max(this.currentSession.totalSteps, params.totalThoughts);

    return step;
  }

  /**
   * Update session state based on thinking parameters
   */
  private updateSessionState(params: ThinkingStepParams): void {
    if (!this.currentSession) return;

    // Update session metadata
    this.currentSession.metadata = {
      ...this.currentSession.metadata,
      lastUpdate: new Date().toISOString(),
      currentThought: params.thoughtNumber,
      totalThoughts: params.totalThoughts,
    };

    // Check if thinking is complete
    if (!params.nextThoughtNeeded && !params.needsMoreThoughts) {
      this.currentSession.state = 'completed';
      this.currentSession.metadata.endTime = new Date().toISOString();
    }
  }

  /**
   * Generate response for the thinking step
   */
  private generateResponse(step: ThinkingStep, params: ThinkingStepParams): {
    llmContent: string;
    returnDisplay: string;
  } {
    const session = this.currentSession!;
    
    // Create progress indicator
    const progress = `${params.thoughtNumber}/${params.totalThoughts}`;
    const progressBar = this.createProgressBar(params.thoughtNumber, params.totalThoughts);
    
    // Create step type indicator
    let stepType = '🤔 Thinking';
    if (params.isRevision) {
      stepType = '🔄 Revising';
    } else if (params.branchFromThought) {
      stepType = '🌿 Branching';
    } else if (params.needsMoreThoughts) {
      stepType = '➕ Extending';
    }

    // Create display content
    const returnDisplay = [
      `${stepType} (${progress})`,
      progressBar,
      '',
      `**Step ${params.thoughtNumber}:** ${step.thought}`,
      '',
    ];

    // Add revision information
    if (params.isRevision && params.revisesThought) {
      returnDisplay.push(`*Revising thought ${params.revisesThought}*`);
      returnDisplay.push('');
    }

    // Add branching information
    if (params.branchFromThought && params.branchId) {
      returnDisplay.push(`*Branching from thought ${params.branchFromThought} (${params.branchId})*`);
      returnDisplay.push('');
    }

    // Add session summary
    if (session.state === 'completed') {
      returnDisplay.push('✅ **Thinking Complete**');
      returnDisplay.push(`Total steps: ${session.steps.length}`);
      returnDisplay.push(`Duration: ${this.calculateDuration(session)}`);
    } else if (params.nextThoughtNeeded) {
      returnDisplay.push('⏳ Continuing to next thought...');
    }

    // Create LLM content (structured for AI consumption)
    const llmContent = [
      `Sequential thinking step ${params.thoughtNumber}/${params.totalThoughts}:`,
      step.thought,
      '',
      `Session ID: ${session.id}`,
      `Step Type: ${stepType}`,
      `Next Thought Needed: ${params.nextThoughtNeeded}`,
      `Session State: ${session.state}`,
    ];

    if (params.isRevision) {
      llmContent.push(`Revising Thought: ${params.revisesThought}`);
    }

    if (params.branchFromThought) {
      llmContent.push(`Branch From: ${params.branchFromThought}`);
      llmContent.push(`Branch ID: ${params.branchId || 'default'}`);
    }

    return {
      llmContent: llmContent.join('\n'),
      returnDisplay: returnDisplay.join('\n'),
    };
  }

  /**
   * Create a visual progress bar
   */
  private createProgressBar(current: number, total: number, width: number = 20): string {
    const progress = Math.min(current / total, 1);
    const filled = Math.floor(progress * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentage = Math.round(progress * 100);
    
    return `[${bar}] ${percentage}%`;
  }

  /**
   * Calculate thinking session duration
   */
  private calculateDuration(session: ThinkingSession): string {
    const startTime = this.safeToDate(
      session.metadata?.startTime || session.steps[0]?.timestamp,
      new Date()
    );
    const endTime = this.safeToDate(session.metadata?.endTime, new Date());
    const duration = endTime.getTime() - startTime.getTime();
    
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get current thinking session
   */
  getCurrentSession(): ThinkingSession | null {
    return this.currentSession;
  }

  /**
   * Start a new thinking session
   */
  startNewSession(): ThinkingSession {
    // Complete current session if active
    if (this.currentSession && this.currentSession.state === 'active') {
      this.currentSession.state = 'completed';
      if (!this.currentSession.metadata) {
        this.currentSession.metadata = {};
      }
      this.currentSession.metadata.endTime = new Date().toISOString();
    }

    // Create new session
    this.currentSession = this.createThinkingSession();
    return this.currentSession;
  }

  /**
   * Get thinking session by ID
   */
  getSession(sessionId: string): ThinkingSession | null {
    return this.sessionHistory.get(sessionId) || null;
  }

  /**
   * Get all thinking sessions
   */
  getAllSessions(): ThinkingSession[] {
    return Array.from(this.sessionHistory.values());
  }

  /**
   * Clear thinking history
   */
  clearHistory(): void {
    this.sessionHistory.clear();
    this.currentSession = null;
  }

  /**
   * Get thinking statistics
   */
  getStatistics(): {
    totalSessions: number;
    totalSteps: number;
    averageStepsPerSession: number;
    completedSessions: number;
    activeSessions: number;
  } {
    const sessions = Array.from(this.sessionHistory.values());
    const totalSteps = sessions.reduce((sum, session) => sum + session.steps.length, 0);
    const completedSessions = sessions.filter(s => s.state === 'completed').length;
    const activeSessions = sessions.filter(s => s.state === 'active').length;

    return {
      totalSessions: sessions.length,
      totalSteps,
      averageStepsPerSession: sessions.length > 0 ? totalSteps / sessions.length : 0,
      completedSessions,
      activeSessions,
    };
  }
}
