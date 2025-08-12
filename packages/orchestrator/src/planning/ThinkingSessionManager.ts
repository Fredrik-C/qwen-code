/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ThinkingSession, ThinkingStep } from '../types/session.js';
import { SequentialThinkingTool } from './SequentialThinkingTool.js';
import { StorageError } from '../state/StateManager.js';

/**
 * Thinking session persistence options
 */
export interface ThinkingPersistenceOptions {
  /** Base directory for thinking session storage */
  baseDir: string;
  /** Whether to auto-save thinking sessions */
  autoSave: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
  /** Whether to compress thinking data */
  compress: boolean;
  /** Maximum thinking sessions to keep */
  maxSessions?: number;
}

/**
 * Thinking session query options
 */
export interface ThinkingSessionQuery {
  /** Filter by orchestration session ID */
  orchestrationSessionId?: string;
  /** Filter by session state */
  state?: 'active' | 'completed' | 'paused';
  /** Filter by purpose */
  purpose?: string;
  /** Filter by date range */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  /** Limit number of results */
  limit?: number;
}

/**
 * Thinking session analysis result
 */
export interface ThinkingAnalysis {
  sessionId: string;
  totalSteps: number;
  duration: number;
  complexity: 'low' | 'medium' | 'high';
  coherence: number; // 0-1 score
  insights: string[];
  patterns: string[];
  recommendations: string[];
}

/**
 * Thinking session manager for persistence and analysis
 */
export class ThinkingSessionManager {
  private options: ThinkingPersistenceOptions;
  private thinkingDir: string;
  private autoSaveTimer?: NodeJS.Timeout;
  private pendingSaves: Set<string> = new Set();

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

  constructor(options: ThinkingPersistenceOptions) {
    this.options = {
      autoSaveInterval: 30000, // 30 seconds
      maxSessions: 1000,
      ...options,
    };
    this.thinkingDir = path.join(this.options.baseDir, 'thinking');
  }

  /**
   * Initialize thinking session manager
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.thinkingDir, { recursive: true });
    
    if (this.options.autoSave && this.options.autoSaveInterval) {
      this.startAutoSave();
    }
  }

  /**
   * Save thinking session to storage
   */
  async saveThinkingSession(session: ThinkingSession): Promise<void> {
    try {
      const filePath = path.join(this.thinkingDir, `${session.id}.json`);
      
      // Prepare session data for storage
      const sessionData = {
        ...session,
        metadata: {
          ...session.metadata,
          savedAt: new Date().toISOString(),
          version: '1.0',
        },
      };

      const jsonData = JSON.stringify(sessionData, null, 2);
      await fs.writeFile(filePath, jsonData, 'utf-8');
      
      this.pendingSaves.delete(session.id);
    } catch (error) {
      throw new StorageError(
        `Failed to save thinking session ${session.id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Load thinking session from storage
   */
  async loadThinkingSession(sessionId: string): Promise<ThinkingSession | null> {
    try {
      const filePath = path.join(this.thinkingDir, `${sessionId}.json`);
      
      try {
        await fs.access(filePath);
      } catch {
        return null; // File doesn't exist
      }

      const data = await fs.readFile(filePath, 'utf-8');
      const sessionData = JSON.parse(data);
      
      // Convert date strings back to Date objects
      sessionData.steps = sessionData.steps.map((step: any) => ({
        ...step,
        timestamp: new Date(step.timestamp),
      }));

      return sessionData as ThinkingSession;
    } catch (error) {
      throw new StorageError(
        `Failed to load thinking session ${sessionId}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Query thinking sessions
   */
  async queryThinkingSessions(query: ThinkingSessionQuery = {}): Promise<ThinkingSession[]> {
    try {
      const files = await fs.readdir(this.thinkingDir);
      const sessionFiles = files.filter(file => file.endsWith('.json'));
      
      const sessions: ThinkingSession[] = [];
      
      for (const file of sessionFiles) {
        try {
          const sessionId = path.basename(file, '.json');
          const session = await this.loadThinkingSession(sessionId);
          
          if (session && this.matchesQuery(session, query)) {
            sessions.push(session);
          }
        } catch (error) {
          console.warn(`Failed to load thinking session from ${file}:`, error);
        }
      }
      
      // Sort by creation time (newest first)
      sessions.sort((a, b) => {
        const aStartTime = a.metadata?.startTime;
        const bStartTime = b.metadata?.startTime;
        const aTime = new Date(
          typeof aStartTime === 'string' || typeof aStartTime === 'number' || aStartTime instanceof Date
            ? aStartTime
            : 0
        ).getTime();
        const bTime = new Date(
          typeof bStartTime === 'string' || typeof bStartTime === 'number' || bStartTime instanceof Date
            ? bStartTime
            : 0
        ).getTime();
        return bTime - aTime;
      });
      
      // Apply limit
      if (query.limit) {
        sessions.splice(query.limit);
      }
      
      return sessions;
    } catch (error) {
      throw new StorageError(
        'Failed to query thinking sessions',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Delete thinking session
   */
  async deleteThinkingSession(sessionId: string): Promise<void> {
    try {
      const filePath = path.join(this.thinkingDir, `${sessionId}.json`);
      await fs.unlink(filePath);
      this.pendingSaves.delete(sessionId);
    } catch (error) {
      throw new StorageError(
        `Failed to delete thinking session ${sessionId}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Analyze thinking session
   */
  async analyzeThinkingSession(sessionId: string): Promise<ThinkingAnalysis | null> {
    const session = await this.loadThinkingSession(sessionId);
    if (!session) return null;

    const analysis: ThinkingAnalysis = {
      sessionId,
      totalSteps: session.steps.length,
      duration: this.calculateSessionDuration(session),
      complexity: this.assessComplexity(session),
      coherence: this.assessCoherence(session),
      insights: this.extractInsights(session),
      patterns: this.identifyPatterns(session),
      recommendations: this.generateRecommendations(session),
    };

    return analysis;
  }

  /**
   * Resume thinking session
   */
  async resumeThinkingSession(
    sessionId: string,
    thinkingTool: SequentialThinkingTool
  ): Promise<ThinkingSession | null> {
    const session = await this.loadThinkingSession(sessionId);
    if (!session) return null;

    // Restore session in thinking tool
    // Note: This would require extending the SequentialThinkingTool to support session restoration
    // For now, we'll create a new session with the restored data
    const newSession = thinkingTool.startNewSession();
    
    // Copy session data
    newSession.id = session.id;
    newSession.steps = session.steps;
    newSession.currentStep = session.currentStep;
    newSession.totalSteps = session.totalSteps;
    newSession.state = session.state;
    newSession.metadata = session.metadata;

    return newSession;
  }

  /**
   * Schedule thinking session for auto-save
   */
  scheduleAutoSave(sessionId: string): void {
    if (this.options.autoSave) {
      this.pendingSaves.add(sessionId);
    }
  }

  /**
   * Get thinking session statistics
   */
  async getStatistics(): Promise<{
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    averageSteps: number;
    averageDuration: number;
    totalStorageSize: number;
  }> {
    const sessions = await this.queryThinkingSessions();
    
    const activeSessions = sessions.filter(s => s.state === 'active').length;
    const completedSessions = sessions.filter(s => s.state === 'completed').length;
    
    const totalSteps = sessions.reduce((sum, s) => sum + s.steps.length, 0);
    const averageSteps = sessions.length > 0 ? totalSteps / sessions.length : 0;
    
    const totalDuration = sessions.reduce((sum, s) => sum + this.calculateSessionDuration(s), 0);
    const averageDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;
    
    // Calculate storage size
    let totalStorageSize = 0;
    try {
      const files = await fs.readdir(this.thinkingDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const stat = await fs.stat(path.join(this.thinkingDir, file));
          totalStorageSize += stat.size;
        }
      }
    } catch (error) {
      console.warn('Failed to calculate storage size:', error);
    }

    return {
      totalSessions: sessions.length,
      activeSessions,
      completedSessions,
      averageSteps,
      averageDuration,
      totalStorageSize,
    };
  }

  /**
   * Cleanup old thinking sessions
   */
  async cleanupOldSessions(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge);
    const sessions = await this.queryThinkingSessions();
    
    let cleanedCount = 0;
    
    for (const session of sessions) {
      const sessionDate = this.safeToDate(session.metadata?.startTime, 0);
      if (sessionDate < cutoffDate && session.state === 'completed') {
        await this.deleteThinkingSession(session.id);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      if (this.pendingSaves.size > 0) {
        console.log(`Auto-saving ${this.pendingSaves.size} thinking sessions...`);
        // Note: In a real implementation, you'd need access to the actual session objects
        // This is a simplified version
      }
    }, this.options.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Check if session matches query
   */
  private matchesQuery(session: ThinkingSession, query: ThinkingSessionQuery): boolean {
    if (query.orchestrationSessionId && 
        session.metadata?.orchestrationSessionId !== query.orchestrationSessionId) {
      return false;
    }
    
    if (query.state && session.state !== query.state) {
      return false;
    }
    
    if (query.purpose && session.metadata?.purpose !== query.purpose) {
      return false;
    }
    
    if (query.dateRange) {
      const sessionDate = this.safeToDate(session.metadata?.startTime, 0);
      if (query.dateRange.from && sessionDate < query.dateRange.from) {
        return false;
      }
      if (query.dateRange.to && sessionDate > query.dateRange.to) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Calculate session duration in milliseconds
   */
  private calculateSessionDuration(session: ThinkingSession): number {
    const startTime = this.safeToDate(
      session.metadata?.startTime || session.steps[0]?.timestamp,
      0
    );
    const endTime = this.safeToDate(session.metadata?.endTime, new Date());
    return endTime.getTime() - startTime.getTime();
  }

  /**
   * Assess thinking complexity
   */
  private assessComplexity(session: ThinkingSession): 'low' | 'medium' | 'high' {
    const stepCount = session.steps.length;
    const hasRevisions = session.steps.some(s => s.isRevision);
    const hasBranching = session.steps.some(s => s.branchFromThought);
    
    if (stepCount > 20 || hasBranching) return 'high';
    if (stepCount > 10 || hasRevisions) return 'medium';
    return 'low';
  }

  /**
   * Assess thinking coherence
   */
  private assessCoherence(session: ThinkingSession): number {
    // Simplified coherence assessment
    // In a real implementation, you might use NLP techniques
    const steps = session.steps;
    if (steps.length === 0) return 0;
    
    let coherenceScore = 1.0;
    
    // Penalize excessive revisions
    const revisionCount = steps.filter(s => s.isRevision).length;
    coherenceScore -= (revisionCount / steps.length) * 0.3;
    
    // Reward logical progression
    const progressiveSteps = steps.filter((s, i) => i === 0 || s.stepNumber === steps[i-1].stepNumber + 1).length;
    coherenceScore += (progressiveSteps / steps.length) * 0.2;
    
    return Math.max(0, Math.min(1, coherenceScore));
  }

  /**
   * Extract insights from thinking session
   */
  private extractInsights(session: ThinkingSession): string[] {
    return session.steps
      .filter(step => step.thought.length > 150) // Longer thoughts likely contain insights
      .slice(-3) // Last 3 significant thoughts
      .map(step => step.thought.substring(0, 200) + (step.thought.length > 200 ? '...' : ''));
  }

  /**
   * Identify thinking patterns
   */
  private identifyPatterns(session: ThinkingSession): string[] {
    const patterns: string[] = [];
    
    if (session.steps.some(s => s.isRevision)) {
      patterns.push('Iterative refinement');
    }
    
    if (session.steps.some(s => s.branchFromThought)) {
      patterns.push('Exploratory branching');
    }
    
    if (session.steps.length > 15) {
      patterns.push('Deep analysis');
    }
    
    return patterns;
  }

  /**
   * Generate recommendations for thinking improvement
   */
  private generateRecommendations(session: ThinkingSession): string[] {
    const recommendations: string[] = [];
    
    if (session.steps.length < 5) {
      recommendations.push('Consider more thorough analysis with additional thinking steps');
    }
    
    if (!session.steps.some(s => s.isRevision)) {
      recommendations.push('Consider reviewing and revising initial thoughts');
    }
    
    if (this.assessCoherence(session) < 0.7) {
      recommendations.push('Focus on maintaining logical flow between thinking steps');
    }
    
    return recommendations;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopAutoSave();
    this.pendingSaves.clear();
  }
}
