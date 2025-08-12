/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { Content } from '@google/genai';
import {
  OrchestrationSession as IOrchestrationSession,
  SessionType,
  SessionState,
  SessionContext,
  SessionMetadata,
  SessionArtifact,
  SessionDecision,
  ThinkingSession,
  ThinkingStep,
  CreateSessionParams,
  UpdateSessionParams,
} from '../types/session.js';

/**
 * Session lifecycle events
 */
export interface SessionEvent {
  type: 'created' | 'activated' | 'suspended' | 'completed' | 'failed' | 'updated';
  timestamp: Date;
  data?: any;
}

/**
 * Session event listener
 */
export type SessionEventListener = (event: SessionEvent) => void;

/**
 * OrchestrationSession class implementation
 */
export class OrchestrationSession implements IOrchestrationSession {
  public readonly id: string;
  public readonly type: SessionType;
  public readonly orchestrationId: string;
  public readonly taskId?: string;
  public readonly timestamp: Date;
  public context: SessionContext;
  public state: SessionState;
  public metadata: SessionMetadata;
  public readonly parentSessionId?: string;
  public childSessionIds: string[];
  public lastActivityAt: Date;
  public completedAt?: Date;
  public failureReason?: string;

  private eventListeners: SessionEventListener[] = [];

  constructor(params: CreateSessionParams) {
    this.id = `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.type = params.type;
    this.orchestrationId = params.orchestrationId;
    this.taskId = params.taskId;
    this.timestamp = new Date();
    this.parentSessionId = params.parentSessionId;
    this.childSessionIds = [];
    this.lastActivityAt = new Date();
    this.state = SessionState.ACTIVE;
    
    this.metadata = {
      name: params.metadata?.name,
      description: params.metadata?.description,
      tags: params.metadata?.tags || [],
      userMetadata: params.metadata?.userMetadata || {},
    };

    this.context = {
      messages: params.context?.messages || [],
      artifacts: params.context?.artifacts || [],
      decisions: params.context?.decisions || [],
      currentFocus: params.context?.currentFocus || params.initialFocus || '',
      variables: params.context?.variables || params.initialVariables || {},
    };

    this.emitEvent({ type: 'created', timestamp: new Date() });
  }

  /**
   * Update session state
   */
  updateState(newState: SessionState, reason?: string): void {
    const oldState = this.state;
    this.state = newState;
    this.lastActivityAt = new Date();

    if (newState === SessionState.COMPLETED) {
      this.completedAt = new Date();
    } else if (newState === SessionState.FAILED) {
      this.failureReason = reason;
    }

    this.emitEvent({
      type: oldState === SessionState.ACTIVE ? 'suspended' : 
            newState === SessionState.ACTIVE ? 'activated' :
            newState === SessionState.COMPLETED ? 'completed' :
            newState === SessionState.FAILED ? 'failed' : 'updated',
      timestamp: new Date(),
      data: { oldState, newState, reason },
    });
  }

  /**
   * Update session context
   */
  updateContext(updates: Partial<SessionContext>): void {
    this.context = {
      ...this.context,
      ...updates,
    };
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { context: updates } });
  }

  /**
   * Add message to session context
   */
  addMessage(message: Content): void {
    this.context.messages.push(message);
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { messageAdded: true } });
  }

  /**
   * Add artifact to session context
   */
  addArtifact(artifact: Omit<SessionArtifact, 'id' | 'createdAt' | 'modifiedAt'>): SessionArtifact {
    const newArtifact: SessionArtifact = {
      ...artifact,
      id: uuidv4(),
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    this.context.artifacts.push(newArtifact);
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { artifactAdded: newArtifact.id } });

    return newArtifact;
  }

  /**
   * Update existing artifact
   */
  updateArtifact(artifactId: string, updates: Partial<SessionArtifact>): SessionArtifact | null {
    const artifactIndex = this.context.artifacts.findIndex(a => a.id === artifactId);
    if (artifactIndex === -1) return null;

    const updatedArtifact = {
      ...this.context.artifacts[artifactIndex],
      ...updates,
      modifiedAt: new Date(),
    };

    this.context.artifacts[artifactIndex] = updatedArtifact;
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { artifactUpdated: artifactId } });

    return updatedArtifact;
  }

  /**
   * Add decision to session context
   */
  addDecision(decision: Omit<SessionDecision, 'id' | 'timestamp'>): SessionDecision {
    const newDecision: SessionDecision = {
      ...decision,
      id: uuidv4(),
      timestamp: new Date(),
    };

    this.context.decisions.push(newDecision);
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { decisionAdded: newDecision.id } });

    return newDecision;
  }

  /**
   * Start sequential thinking session
   */
  startThinking(metadata?: Record<string, unknown>): ThinkingSession {
    const thinkingSession: ThinkingSession = {
      id: uuidv4(),
      steps: [],
      currentStep: 0,
      totalSteps: 1,
      state: 'active',
      metadata: metadata || {},
    };

    this.context.sequentialThinking = thinkingSession;
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { thinkingStarted: thinkingSession.id } });

    return thinkingSession;
  }

  /**
   * Add thinking step
   */
  addThinkingStep(step: Omit<ThinkingStep, 'timestamp'>): void {
    if (!this.context.sequentialThinking) {
      throw new Error('No active thinking session');
    }

    const thinkingStep = {
      ...step,
      timestamp: new Date(),
    };

    this.context.sequentialThinking.steps.push(thinkingStep);
    this.context.sequentialThinking.currentStep = this.context.sequentialThinking.steps.length;
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { thinkingStepAdded: true } });
  }

  /**
   * Complete thinking session
   */
  completeThinking(): void {
    if (!this.context.sequentialThinking) {
      throw new Error('No active thinking session');
    }

    this.context.sequentialThinking.state = 'completed';
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { thinkingCompleted: true } });
  }

  /**
   * Update session focus
   */
  updateFocus(newFocus: string): void {
    this.context.currentFocus = newFocus;
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { focusChanged: newFocus } });
  }

  /**
   * Set session variable
   */
  setVariable(key: string, value: unknown): void {
    if (!this.context.variables) {
      this.context.variables = {};
    }
    this.context.variables[key] = value;
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { variableSet: key } });
  }

  /**
   * Get session variable
   */
  getVariable(key: string): unknown {
    return this.context.variables?.[key];
  }

  /**
   * Add child session
   */
  addChildSession(childSessionId: string): void {
    if (!this.childSessionIds.includes(childSessionId)) {
      this.childSessionIds.push(childSessionId);
      this.lastActivityAt = new Date();
      this.emitEvent({ type: 'updated', timestamp: new Date(), data: { childAdded: childSessionId } });
    }
  }

  /**
   * Remove child session
   */
  removeChildSession(childSessionId: string): void {
    const index = this.childSessionIds.indexOf(childSessionId);
    if (index !== -1) {
      this.childSessionIds.splice(index, 1);
      this.lastActivityAt = new Date();
      this.emitEvent({ type: 'updated', timestamp: new Date(), data: { childRemoved: childSessionId } });
    }
  }

  /**
   * Update session metadata
   */
  updateMetadata(updates: Partial<SessionMetadata>): void {
    this.metadata = {
      ...this.metadata,
      ...updates,
      tags: updates.tags || this.metadata.tags,
      userMetadata: {
        ...this.metadata.userMetadata,
        ...updates.userMetadata,
      },
    };
    this.lastActivityAt = new Date();
    this.emitEvent({ type: 'updated', timestamp: new Date(), data: { metadataUpdated: true } });
  }

  /**
   * Get session summary
   */
  getSummary(): {
    id: string;
    type: SessionType;
    state: SessionState;
    focus: string;
    messageCount: number;
    artifactCount: number;
    decisionCount: number;
    duration: number;
    isThinking: boolean;
  } {
    const now = new Date();
    const duration = now.getTime() - this.timestamp.getTime();

    return {
      id: this.id,
      type: this.type,
      state: this.state,
      focus: this.context.currentFocus,
      messageCount: this.context.messages.length,
      artifactCount: this.context.artifacts.length,
      decisionCount: this.context.decisions.length,
      duration,
      isThinking: this.context.sequentialThinking?.state === 'active',
    };
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.state === SessionState.ACTIVE;
  }

  /**
   * Check if session is completed
   */
  isCompleted(): boolean {
    return this.state === SessionState.COMPLETED;
  }

  /**
   * Check if session has failed
   */
  hasFailed(): boolean {
    return this.state === SessionState.FAILED;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: SessionEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: SessionEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit session event
   */
  private emitEvent(event: SessionEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Session event listener error:', error);
      }
    });
  }

  /**
   * Serialize session to JSON
   */
  toJSON(): IOrchestrationSession {
    return {
      id: this.id,
      type: this.type,
      orchestrationId: this.orchestrationId,
      taskId: this.taskId,
      timestamp: this.timestamp,
      context: this.context,
      state: this.state,
      metadata: this.metadata,
      parentSessionId: this.parentSessionId,
      childSessionIds: this.childSessionIds,
      lastActivityAt: this.lastActivityAt,
      completedAt: this.completedAt,
      failureReason: this.failureReason,
    };
  }

  /**
   * Create session from JSON data
   */
  static fromJSON(data: IOrchestrationSession): OrchestrationSession {
    const session = Object.create(OrchestrationSession.prototype);
    Object.assign(session, data);
    session.eventListeners = [];
    return session;
  }
}
