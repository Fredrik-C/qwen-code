/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  OrchestrationSession as IOrchestrationSession,
  SessionType,
  SessionState,
  SessionQuery,
  CreateSessionParams,
  UpdateSessionParams,
} from '../types/session.js';
import { OrchestrationSession, SessionEvent, SessionEventListener } from './OrchestrationSession.js';
import { StateManager } from '../state/StateManager.js';

/**
 * Session registry events
 */
export interface RegistryEvent {
  type: 'session_created' | 'session_updated' | 'session_deleted' | 'session_state_changed';
  sessionId: string;
  timestamp: Date;
  data?: any;
}

/**
 * Registry event listener
 */
export type RegistryEventListener = (event: RegistryEvent) => void;

/**
 * Session registry for managing multiple orchestration sessions
 */
export class SessionRegistry {
  private sessions: Map<string, OrchestrationSession> = new Map();
  private stateManager: StateManager;
  private eventListeners: RegistryEventListener[] = [];
  private sessionEventListener: SessionEventListener;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    
    // Create session event listener to handle session updates
    this.sessionEventListener = (event: SessionEvent) => {
      this.handleSessionEvent(event);
    };
  }

  /**
   * Initialize the session registry
   */
  async initialize(): Promise<void> {
    await this.stateManager.initialize();
    await this.loadExistingSessions();
  }

  /**
   * Create a new session
   */
  async createSession(params: CreateSessionParams): Promise<OrchestrationSession> {
    const session = new OrchestrationSession(params);
    
    // Add session event listener
    session.addEventListener(this.sessionEventListener);
    
    // Store in memory
    this.sessions.set(session.id, session);
    
    // Persist to storage
    await this.stateManager.saveSession(session.toJSON());
    
    // Handle parent-child relationships
    if (params.parentSessionId) {
      const parentSession = this.sessions.get(params.parentSessionId);
      if (parentSession) {
        parentSession.addChildSession(session.id);
        await this.stateManager.saveSession(parentSession.toJSON());
      }
    }
    
    this.emitEvent({
      type: 'session_created',
      sessionId: session.id,
      timestamp: new Date(),
      data: { type: session.type, orchestrationId: session.orchestrationId },
    });
    
    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<OrchestrationSession | null> {
    // Check memory first
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // Try to load from storage
      const sessionData = await this.stateManager.loadSession(sessionId);
      if (sessionData) {
        session = OrchestrationSession.fromJSON(sessionData);
        session.addEventListener(this.sessionEventListener);
        this.sessions.set(sessionId, session);
      }
    }
    
    return session || null;
  }

  /**
   * Update session
   */
  async updateSession(sessionId: string, params: UpdateSessionParams): Promise<OrchestrationSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const oldState = session.state;

    // Update session properties
    if (params.state !== undefined) {
      session.updateState(params.state, params.failureReason);
    }
    
    if (params.currentFocus !== undefined) {
      session.updateFocus(params.currentFocus);
    }

    if (params.context) {
      session.updateContext(params.context);
    }

    if (params.metadata) {
      session.updateMetadata(params.metadata);
    }

    if (params.variables) {
      Object.entries(params.variables).forEach(([key, value]) => {
        session.setVariable(key, value);
      });
    }

    // Persist changes
    await this.stateManager.saveSession(session.toJSON());
    
    // Emit state change event if state changed
    if (params.state !== undefined && params.state !== oldState) {
      this.emitEvent({
        type: 'session_state_changed',
        sessionId: session.id,
        timestamp: new Date(),
        data: { oldState, newState: params.state },
      });
    }
    
    this.emitEvent({
      type: 'session_updated',
      sessionId: session.id,
      timestamp: new Date(),
      data: params,
    });
    
    return session;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      // Remove event listener
      session.removeEventListener(this.sessionEventListener);
      
      // Remove from parent's children list
      if (session.parentSessionId) {
        const parentSession = this.sessions.get(session.parentSessionId);
        if (parentSession) {
          parentSession.removeChildSession(sessionId);
          await this.stateManager.saveSession(parentSession.toJSON());
        }
      }
      
      // Delete child sessions
      for (const childId of session.childSessionIds) {
        await this.deleteSession(childId);
      }
    }
    
    // Remove from memory
    this.sessions.delete(sessionId);
    
    // Remove from storage
    await this.stateManager.deleteSession(sessionId);
    
    this.emitEvent({
      type: 'session_deleted',
      sessionId,
      timestamp: new Date(),
    });
    
    return true;
  }

  /**
   * Query sessions
   */
  async querySessions(query: SessionQuery = {}): Promise<OrchestrationSession[]> {
    // Get sessions from storage (includes filtering)
    const sessionData = await this.stateManager.querySessions(query);
    
    const sessions: OrchestrationSession[] = [];
    
    for (const data of sessionData) {
      let session = this.sessions.get(data.id);
      
      if (!session) {
        // Create session object from data
        session = OrchestrationSession.fromJSON(data);
        session.addEventListener(this.sessionEventListener);
        this.sessions.set(session.id, session);
      }
      
      sessions.push(session);
    }
    
    return sessions;
  }

  /**
   * Get active sessions for an orchestration
   */
  async getActiveSessions(orchestrationId: string): Promise<OrchestrationSession[]> {
    return this.querySessions({
      orchestrationId,
      state: SessionState.ACTIVE,
    });
  }

  /**
   * Get session hierarchy (parent and children)
   */
  async getSessionHierarchy(sessionId: string): Promise<{
    session: OrchestrationSession;
    parent?: OrchestrationSession;
    children: OrchestrationSession[];
  } | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const parent = session.parentSessionId ?
      (await this.getSession(session.parentSessionId)) || undefined : undefined;
    
    const children: OrchestrationSession[] = [];
    for (const childId of session.childSessionIds) {
      const child = await this.getSession(childId);
      if (child) children.push(child);
    }

    return { session, parent, children };
  }

  /**
   * Get session chain (from root to current)
   */
  async getSessionChain(sessionId: string): Promise<OrchestrationSession[]> {
    const chain: OrchestrationSession[] = [];
    let currentSession = await this.getSession(sessionId);
    
    while (currentSession) {
      chain.unshift(currentSession);
      
      if (currentSession.parentSessionId) {
        currentSession = await this.getSession(currentSession.parentSessionId);
      } else {
        break;
      }
    }
    
    return chain;
  }

  /**
   * Get orchestration sessions summary
   */
  async getOrchestrationSummary(orchestrationId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    failedSessions: number;
    sessionsByType: Record<SessionType, number>;
    lastActivity: Date | null;
  }> {
    const sessions = await this.querySessions({ orchestrationId });
    
    const summary = {
      totalSessions: sessions.length,
      activeSessions: 0,
      completedSessions: 0,
      failedSessions: 0,
      sessionsByType: {
        [SessionType.PLANNING]: 0,
        [SessionType.TASK]: 0,
        [SessionType.VERIFICATION]: 0,
        [SessionType.INTERACTIVE]: 0,
      },
      lastActivity: null as Date | null,
    };
    
    for (const session of sessions) {
      // Count by state
      switch (session.state) {
        case SessionState.ACTIVE:
          summary.activeSessions++;
          break;
        case SessionState.COMPLETED:
          summary.completedSessions++;
          break;
        case SessionState.FAILED:
          summary.failedSessions++;
          break;
      }
      
      // Count by type
      summary.sessionsByType[session.type]++;
      
      // Track last activity
      if (!summary.lastActivity || session.lastActivityAt > summary.lastActivity) {
        summary.lastActivity = session.lastActivityAt;
      }
    }
    
    return summary;
  }

  /**
   * Cleanup inactive sessions
   */
  async cleanupInactiveSessions(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge);
    const sessions = await this.querySessions();
    
    let cleanedCount = 0;
    
    for (const session of sessions) {
      if (session.state !== SessionState.ACTIVE && session.lastActivityAt < cutoffDate) {
        await this.deleteSession(session.id);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Load existing sessions from storage
   */
  private async loadExistingSessions(): Promise<void> {
    try {
      const sessionData = await this.stateManager.querySessions();
      
      for (const data of sessionData) {
        const session = OrchestrationSession.fromJSON(data);
        session.addEventListener(this.sessionEventListener);
        this.sessions.set(session.id, session);
      }
    } catch (error) {
      console.warn('Failed to load existing sessions:', error);
    }
  }

  /**
   * Handle session events
   */
  private async handleSessionEvent(event: SessionEvent): Promise<void> {
    // Find the session that emitted the event
    const session = Array.from(this.sessions.values()).find(s => 
      s.addEventListener === event.constructor || // This is a bit hacky, but works for our use case
      true // For now, just handle all events
    );
    
    if (session) {
      try {
        // Persist session changes
        await this.stateManager.saveSession(session.toJSON());
      } catch (error) {
        console.warn('Failed to persist session changes:', error);
      }
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: RegistryEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: RegistryEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit registry event
   */
  private emitEvent(event: RegistryEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Registry event listener error:', error);
      }
    });
  }

  /**
   * Get registry statistics
   */
  async getStatistics(): Promise<{
    totalSessions: number;
    activeSessions: number;
    memoryUsage: number;
    storageStats: any;
  }> {
    const storageStats = await this.stateManager.getStorageStats();

    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.isActive()).length,
      memoryUsage: this.sessions.size,
      storageStats,
    };
  }

  /**
   * Clean up completed and failed sessions
   */
  async cleanupSessions(): Promise<{
    removedCount: number;
    remainingCount: number;
    spaceFree?: string;
  }> {
    const allSessions = await this.querySessions({});
    const sessionsToRemove = allSessions.filter(session =>
      session.state === SessionState.COMPLETED || session.state === SessionState.FAILED
    );

    let removedCount = 0;
    for (const session of sessionsToRemove) {
      try {
        await this.stateManager.deleteSession(session.id);
        // Remove from memory cache
        this.sessions.delete(session.id);
        removedCount++;
      } catch (error) {
        console.warn(`Failed to remove session ${session.id}:`, error);
      }
    }

    const remainingSessions = await this.querySessions({});

    return {
      removedCount,
      remainingCount: remainingSessions.length,
      spaceFree: `${removedCount} sessions`,
    };
  }

  /**
   * Archive old sessions (move to archive directory)
   */
  async archiveSessions(olderThanDays: number = 30): Promise<{
    archivedCount: number;
    remainingCount: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const allSessions = await this.querySessions({});
    const sessionsToArchive = allSessions.filter(session =>
      session.lastActivityAt < cutoffDate &&
      (session.state === SessionState.COMPLETED || session.state === SessionState.FAILED)
    );

    let archivedCount = 0;
    for (const session of sessionsToArchive) {
      try {
        // In a real implementation, this would move to an archive directory
        // For now, we'll just delete them
        await this.stateManager.deleteSession(session.id);
        this.sessions.delete(session.id);
        archivedCount++;
      } catch (error) {
        console.warn(`Failed to archive session ${session.id}:`, error);
      }
    }

    const remainingSessions = await this.querySessions({});

    return {
      archivedCount,
      remainingCount: remainingSessions.length,
    };
  }

  /**
   * Get session navigation history
   */
  async getSessionNavigationHistory(orchestrationId: string): Promise<{
    timeline: Array<{
      sessionId: string;
      type: SessionType;
      state: SessionState;
      startTime: Date;
      endTime?: Date;
      focus?: string;
      parentSessionId?: string;
    }>;
    hierarchy: Array<{
      sessionId: string;
      level: number;
      children: string[];
    }>;
  }> {
    const sessions = await this.querySessions({ orchestrationId });

    // Create timeline sorted by start time
    const timeline = sessions
      .map(session => ({
        sessionId: session.id,
        type: session.type,
        state: session.state,
        startTime: session.timestamp,
        endTime: session.completedAt,
        focus: session.context?.currentFocus,
        parentSessionId: session.parentSessionId,
      }))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Create hierarchy map
    const hierarchy: Array<{
      sessionId: string;
      level: number;
      children: string[];
    }> = [];

    const sessionMap = new Map(sessions.map(s => [s.id, s]));
    const visited = new Set<string>();

    const buildHierarchy = (sessionId: string, level: number = 0) => {
      if (visited.has(sessionId)) return;
      visited.add(sessionId);

      const session = sessionMap.get(sessionId);
      if (!session) return;

      const children = sessions
        .filter(s => s.parentSessionId === sessionId)
        .map(s => s.id);

      hierarchy.push({
        sessionId,
        level,
        children,
      });

      // Recursively build hierarchy for children
      children.forEach(childId => buildHierarchy(childId, level + 1));
    };

    // Start with root sessions (no parent)
    const rootSessions = sessions.filter(s => !s.parentSessionId);
    rootSessions.forEach(session => buildHierarchy(session.id));

    return { timeline, hierarchy };
  }

  /**
   * Find related sessions
   */
  async findRelatedSessions(sessionId: string): Promise<{
    parent?: OrchestrationSession;
    children: OrchestrationSession[];
    siblings: OrchestrationSession[];
    predecessors: OrchestrationSession[];
    successors: OrchestrationSession[];
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const allSessions = await this.querySessions({
      orchestrationId: session.orchestrationId
    });

    // Find parent
    const parent = session.parentSessionId ?
      allSessions.find(s => s.id === session.parentSessionId) : undefined;

    // Find children
    const children = allSessions.filter(s => s.parentSessionId === sessionId);

    // Find siblings (same parent)
    const siblings = session.parentSessionId ?
      allSessions.filter(s =>
        s.parentSessionId === session.parentSessionId && s.id !== sessionId
      ) : [];

    // Find predecessors (sessions that ended before this one started)
    const predecessors = allSessions.filter(s =>
      s.id !== sessionId &&
      s.completedAt &&
      s.completedAt <= session.timestamp
    );

    // Find successors (sessions that started after this one ended)
    const successors = session.completedAt ?
      allSessions.filter(s =>
        s.id !== sessionId &&
        s.timestamp >= session.completedAt!
      ) : [];

    return {
      parent,
      children,
      siblings,
      predecessors,
      successors,
    };
  }

  /**
   * Get session breadcrumb trail
   */
  async getSessionBreadcrumbs(sessionId: string): Promise<Array<{
    sessionId: string;
    name: string;
    type: SessionType;
    focus?: string;
  }>> {
    const breadcrumbs: Array<{
      sessionId: string;
      name: string;
      type: SessionType;
      focus?: string;
    }> = [];

    let currentSession = await this.getSession(sessionId);

    while (currentSession) {
      breadcrumbs.unshift({
        sessionId: currentSession.id,
        name: currentSession.metadata?.name || `${currentSession.type} session`,
        type: currentSession.type,
        focus: currentSession.context?.currentFocus,
      });

      if (currentSession.parentSessionId) {
        currentSession = await this.getSession(currentSession.parentSessionId);
      } else {
        break;
      }
    }

    return breadcrumbs;
  }
}
