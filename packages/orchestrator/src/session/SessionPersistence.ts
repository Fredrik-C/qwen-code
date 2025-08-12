/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { 
  OrchestrationSession as IOrchestrationSession,
  SessionType,
  SessionState,
} from '../types/session.js';
import { OrchestrationSession } from './OrchestrationSession.js';
import { StorageError, ValidationError, CorruptionError } from '../state/StateManager.js';

/**
 * Session recovery information
 */
export interface SessionRecoveryInfo {
  sessionId: string;
  lastKnownState: SessionState;
  lastActivity: Date;
  corruptionLevel: 'none' | 'minor' | 'major' | 'total';
  recoveryActions: string[];
  backupAvailable: boolean;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fixableIssues: string[];
}

/**
 * Session serialization options
 */
export interface SerializationOptions {
  includeMessages: boolean;
  includeArtifacts: boolean;
  includeThinking: boolean;
  compressData: boolean;
}

/**
 * Session persistence utilities
 */
export class SessionPersistence {
  private baseDir: string;
  private recoveryDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.recoveryDir = path.join(baseDir, 'recovery');
  }

  /**
   * Initialize persistence utilities
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.recoveryDir, { recursive: true });
  }

  /**
   * Serialize session with options
   */
  serializeSession(session: OrchestrationSession, options: SerializationOptions = {
    includeMessages: true,
    includeArtifacts: true,
    includeThinking: true,
    compressData: false,
  }): string {
    const sessionData = session.toJSON();
    
    // Apply serialization options
    if (!options.includeMessages) {
      sessionData.context.messages = [];
    }
    
    if (!options.includeArtifacts) {
      sessionData.context.artifacts = [];
    }
    
    if (!options.includeThinking) {
      sessionData.context.sequentialThinking = undefined;
    }
    
    // Convert dates to ISO strings for JSON serialization
    const serializedData = {
      ...sessionData,
      timestamp: sessionData.timestamp.toISOString(),
      lastActivityAt: sessionData.lastActivityAt.toISOString(),
      completedAt: sessionData.completedAt?.toISOString(),
      context: {
        ...sessionData.context,
        artifacts: sessionData.context.artifacts.map(artifact => ({
          ...artifact,
          createdAt: artifact.createdAt.toISOString(),
          modifiedAt: artifact.modifiedAt.toISOString(),
        })),
        decisions: sessionData.context.decisions.map(decision => ({
          ...decision,
          timestamp: decision.timestamp.toISOString(),
        })),
        sequentialThinking: sessionData.context.sequentialThinking ? {
          ...sessionData.context.sequentialThinking,
          steps: sessionData.context.sequentialThinking.steps.map(step => ({
            ...step,
            timestamp: step.timestamp.toISOString(),
          })),
        } : undefined,
      },
    };
    
    const jsonString = JSON.stringify(serializedData, null, 2);
    
    // Apply compression if requested
    if (options.compressData) {
      // For now, just return the JSON string
      // In a real implementation, you might use a compression library
      return jsonString;
    }
    
    return jsonString;
  }

  /**
   * Deserialize session from JSON string
   */
  deserializeSession(jsonString: string): OrchestrationSession {
    try {
      const data = JSON.parse(jsonString);
      
      // Convert ISO strings back to Date objects
      const sessionData: IOrchestrationSession = {
        ...data,
        timestamp: new Date(data.timestamp),
        lastActivityAt: new Date(data.lastActivityAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        context: {
          ...data.context,
          artifacts: data.context.artifacts.map((artifact: any) => ({
            ...artifact,
            createdAt: new Date(artifact.createdAt),
            modifiedAt: new Date(artifact.modifiedAt),
          })),
          decisions: data.context.decisions.map((decision: any) => ({
            ...decision,
            timestamp: new Date(decision.timestamp),
          })),
          sequentialThinking: data.context.sequentialThinking ? {
            ...data.context.sequentialThinking,
            steps: data.context.sequentialThinking.steps.map((step: any) => ({
              ...step,
              timestamp: new Date(step.timestamp),
            })),
          } : undefined,
        },
      };
      
      return OrchestrationSession.fromJSON(sessionData);
    } catch (error) {
      throw new ValidationError(
        'Failed to deserialize session',
        error instanceof z.ZodError ? error : new z.ZodError([])
      );
    }
  }

  /**
   * Validate session data
   */
  validateSession(session: IOrchestrationSession): SessionValidationResult {
    const result: SessionValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      fixableIssues: [],
    };

    // Check required fields
    if (!session.id) {
      result.errors.push('Session ID is missing');
      result.isValid = false;
    }

    if (!session.orchestrationId) {
      result.errors.push('Orchestration ID is missing');
      result.isValid = false;
    }

    if (!Object.values(SessionType).includes(session.type)) {
      result.errors.push(`Invalid session type: ${session.type}`);
      result.isValid = false;
    }

    if (!Object.values(SessionState).includes(session.state)) {
      result.errors.push(`Invalid session state: ${session.state}`);
      result.isValid = false;
    }

    // Check timestamps
    if (!(session.timestamp instanceof Date) && !session.timestamp) {
      result.errors.push('Session timestamp is missing or invalid');
      result.isValid = false;
    }

    if (!(session.lastActivityAt instanceof Date) && !session.lastActivityAt) {
      result.errors.push('Last activity timestamp is missing or invalid');
      result.isValid = false;
    }

    // Check context
    if (!session.context) {
      result.errors.push('Session context is missing');
      result.isValid = false;
    } else {
      if (!session.context.currentFocus) {
        result.warnings.push('Session focus is not set');
        result.fixableIssues.push('Set session focus');
      }

      if (!Array.isArray(session.context.messages)) {
        result.errors.push('Session messages must be an array');
        result.isValid = false;
      }

      if (!Array.isArray(session.context.artifacts)) {
        result.errors.push('Session artifacts must be an array');
        result.isValid = false;
      }

      if (!Array.isArray(session.context.decisions)) {
        result.errors.push('Session decisions must be an array');
        result.isValid = false;
      }
    }

    // Check metadata
    if (!session.metadata) {
      result.warnings.push('Session metadata is missing');
      result.fixableIssues.push('Initialize session metadata');
    }

    // Check child session IDs
    if (session.childSessionIds && !Array.isArray(session.childSessionIds)) {
      result.errors.push('Child session IDs must be an array');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Attempt to recover a corrupted session
   */
  async recoverSession(sessionId: string, sessionData: any): Promise<SessionRecoveryInfo> {
    const recoveryInfo: SessionRecoveryInfo = {
      sessionId,
      lastKnownState: SessionState.FAILED,
      lastActivity: new Date(),
      corruptionLevel: 'none',
      recoveryActions: [],
      backupAvailable: false,
    };

    try {
      // Check if backup exists
      const backupPath = path.join(this.recoveryDir, `${sessionId}-backup.json`);
      try {
        await fs.access(backupPath);
        recoveryInfo.backupAvailable = true;
        recoveryInfo.recoveryActions.push('Backup file available for restoration');
      } catch {
        // No backup available
      }

      // Analyze corruption level
      if (!sessionData) {
        recoveryInfo.corruptionLevel = 'total';
        recoveryInfo.recoveryActions.push('Session data is completely missing');
        return recoveryInfo;
      }

      if (typeof sessionData !== 'object') {
        recoveryInfo.corruptionLevel = 'total';
        recoveryInfo.recoveryActions.push('Session data is not a valid object');
        return recoveryInfo;
      }

      // Check for basic structure
      const hasId = sessionData.id;
      const hasType = sessionData.type;
      const hasOrchestrationId = sessionData.orchestrationId;
      const hasContext = sessionData.context;

      if (!hasId || !hasType || !hasOrchestrationId) {
        recoveryInfo.corruptionLevel = 'major';
        recoveryInfo.recoveryActions.push('Critical session fields are missing');
      } else if (!hasContext) {
        recoveryInfo.corruptionLevel = 'minor';
        recoveryInfo.recoveryActions.push('Session context is missing but can be reconstructed');
      } else {
        recoveryInfo.corruptionLevel = 'none';
        recoveryInfo.recoveryActions.push('Session appears to be intact');
      }

      // Extract what we can
      if (sessionData.state) {
        recoveryInfo.lastKnownState = sessionData.state;
      }

      if (sessionData.lastActivityAt) {
        recoveryInfo.lastActivity = new Date(sessionData.lastActivityAt);
      }

      // Suggest recovery actions
      if (recoveryInfo.corruptionLevel === 'minor') {
        recoveryInfo.recoveryActions.push('Reconstruct missing context with default values');
        recoveryInfo.recoveryActions.push('Mark session as suspended for manual review');
      } else if (recoveryInfo.corruptionLevel === 'major') {
        if (recoveryInfo.backupAvailable) {
          recoveryInfo.recoveryActions.push('Restore from backup file');
        } else {
          recoveryInfo.recoveryActions.push('Create new session with recovered metadata');
          recoveryInfo.recoveryActions.push('Mark original session as failed');
        }
      }

    } catch (error) {
      recoveryInfo.corruptionLevel = 'total';
      recoveryInfo.recoveryActions.push(`Recovery analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return recoveryInfo;
  }

  /**
   * Create recovery backup
   */
  async createRecoveryBackup(sessionId: string, sessionData: IOrchestrationSession): Promise<void> {
    try {
      const backupPath = path.join(this.recoveryDir, `${sessionId}-backup.json`);
      const backupData = {
        sessionId,
        timestamp: new Date().toISOString(),
        originalData: sessionData,
      };
      
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to create recovery backup for session ${sessionId}:`, error);
    }
  }

  /**
   * Restore from recovery backup
   */
  async restoreFromBackup(sessionId: string): Promise<OrchestrationSession | null> {
    try {
      const backupPath = path.join(this.recoveryDir, `${sessionId}-backup.json`);
      const backupData = await fs.readFile(backupPath, 'utf-8');
      const parsed = JSON.parse(backupData);
      
      if (parsed.originalData) {
        return OrchestrationSession.fromJSON(parsed.originalData);
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to restore session ${sessionId} from backup:`, error);
      return null;
    }
  }

  /**
   * Clean up old recovery files
   */
  async cleanupRecoveryFiles(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const files = await fs.readdir(this.recoveryDir);
      const cutoffDate = new Date(Date.now() - maxAge);
      let cleanedCount = 0;

      for (const file of files) {
        if (file.endsWith('-backup.json')) {
          const filePath = path.join(this.recoveryDir, file);
          const stat = await fs.stat(filePath);
          
          if (stat.mtime < cutoffDate) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      console.warn('Failed to cleanup recovery files:', error);
      return 0;
    }
  }

  /**
   * Get recovery statistics
   */
  async getRecoveryStats(): Promise<{
    backupCount: number;
    totalBackupSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    try {
      const files = await fs.readdir(this.recoveryDir);
      const backupFiles = files.filter(file => file.endsWith('-backup.json'));
      
      let totalSize = 0;
      let oldestBackup: Date | null = null;
      let newestBackup: Date | null = null;

      for (const file of backupFiles) {
        const filePath = path.join(this.recoveryDir, file);
        const stat = await fs.stat(filePath);
        
        totalSize += stat.size;
        
        if (!oldestBackup || stat.mtime < oldestBackup) {
          oldestBackup = stat.mtime;
        }
        
        if (!newestBackup || stat.mtime > newestBackup) {
          newestBackup = stat.mtime;
        }
      }

      return {
        backupCount: backupFiles.length,
        totalBackupSize: totalSize,
        oldestBackup,
        newestBackup,
      };
    } catch (error) {
      console.warn('Failed to get recovery stats:', error);
      return {
        backupCount: 0,
        totalBackupSize: 0,
        oldestBackup: null,
        newestBackup: null,
      };
    }
  }
}
