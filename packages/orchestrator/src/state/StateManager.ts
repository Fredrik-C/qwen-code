/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { 
  OrchestrationSession, 
  SessionQuery, 
  CreateSessionParams, 
  UpdateSessionParams,
  SessionType,
  SessionState 
} from '../types/session.js';
import { Task, TaskQuery, CreateTaskParams, UpdateTaskParams } from '../types/task.js';
import { DevelopmentPlan, CreatePlanParams, UpdatePlanParams } from '../types/planning.js';
import { VerificationReport, CreateVerificationParams, UpdateVerificationParams } from '../types/verification.js';
import { errorHandler, createOrchestrationError } from '../utils/ErrorHandler.js';
import { ValidationUtils } from '../utils/ValidationUtils.js';
import { RecoveryUtils } from '../utils/RecoveryUtils.js';

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Base directory for orchestration data */
  baseDir: string;
  /** Enable backup creation */
  enableBackups?: boolean;
  /** Maximum number of backups to keep */
  maxBackups?: number;
  /** Enable compression for storage */
  enableCompression?: boolean;
}

/**
 * Storage error types
 */
export class StorageError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'StorageError';
  }
}

export class ValidationError extends StorageError {
  constructor(message: string, public readonly validationErrors: z.ZodError) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class CorruptionError extends StorageError {
  constructor(message: string, public readonly filePath: string) {
    super(message);
    this.name = 'CorruptionError';
  }
}



/**
 * State manager for persistent storage
 */
export class StateManager {
  private config: StorageConfig;
  private sessionsDir: string;
  private tasksDir: string;
  private plansDir: string;
  private verificationsDir: string;
  private backupsDir: string;

  constructor(config: StorageConfig) {
    this.config = {
      enableBackups: true,
      maxBackups: 10,
      enableCompression: false,
      ...config,
    };

    this.sessionsDir = path.join(this.config.baseDir, 'sessions');
    this.tasksDir = path.join(this.config.baseDir, 'tasks');
    this.plansDir = path.join(this.config.baseDir, 'plans');
    this.verificationsDir = path.join(this.config.baseDir, 'verifications');
    this.backupsDir = path.join(this.config.baseDir, 'backups');
  }

  /**
   * Write file with retry mechanism for handling file lock issues
   */
  private async writeFileWithRetry(filePath: string, data: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fs.writeFile(filePath, data, 'utf-8');
        return;
      } catch (error: any) {
        if (error.code === 'EBUSY' && attempt < maxRetries) {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 10 * attempt));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        fs.mkdir(this.sessionsDir, { recursive: true }),
        fs.mkdir(this.tasksDir, { recursive: true }),
        fs.mkdir(this.plansDir, { recursive: true }),
        fs.mkdir(this.verificationsDir, { recursive: true }),
        fs.mkdir(this.backupsDir, { recursive: true }),
      ]);
    } catch (error) {
      throw new StorageError(
        'Failed to initialize storage directories',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Save session to storage
   */
  async saveSession(session: OrchestrationSession): Promise<void> {
    try {
      // Validate session data
      const validation = ValidationUtils.validateSession(session);
      if (!validation.isValid) {
        throw new StorageError(`Session validation failed: ${validation.errors.join(', ')}`);
      }

      // Create backup if enabled
      if (this.config.enableBackups) {
        await this.createBackup('sessions', session.id);
      }

      // Save session with retry for file lock issues
      const filePath = path.join(this.sessionsDir, `${session.id}.json`);
      const data = JSON.stringify(validation.session, null, 2);
      await this.writeFileWithRetry(filePath, data);

    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        `Failed to save session ${session.id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Load session from storage
   */
  async loadSession(sessionId: string): Promise<OrchestrationSession | null> {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      
      try {
        await fs.access(filePath);
      } catch {
        return null; // File doesn't exist
      }

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Validate loaded data
      const validation = ValidationUtils.validateSession(parsed);
      if (!validation.isValid) {
        throw new StorageError(`Session ${sessionId} validation failed: ${validation.errors.join(', ')}`);
      }
      return validation.session as OrchestrationSession;
      
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      if (error instanceof SyntaxError) {
        throw new CorruptionError(
          `Session file ${sessionId} is corrupted`,
          path.join(this.sessionsDir, `${sessionId}.json`)
        );
      }
      throw new StorageError(
        `Failed to load session ${sessionId}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Delete session from storage
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      
      // Create backup before deletion
      if (this.config.enableBackups) {
        await this.createBackup('sessions', sessionId);
      }
      
      await fs.unlink(filePath);
    } catch (error) {
      throw new StorageError(
        `Failed to delete session ${sessionId}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Query sessions with filtering
   */
  async querySessions(query: SessionQuery = {}): Promise<OrchestrationSession[]> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(file => file.endsWith('.json'));
      
      const sessions: OrchestrationSession[] = [];
      
      for (const file of sessionFiles) {
        try {
          const sessionId = path.basename(file, '.json');
          const session = await this.loadSession(sessionId);
          
          if (session && this.matchesQuery(session, query)) {
            sessions.push(session);
          }
        } catch (error) {
          // Log error but continue processing other sessions
          console.warn(`Failed to load session from ${file}:`, error);
        }
      }
      
      // Apply sorting and pagination
      sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      if (query.offset) {
        sessions.splice(0, query.offset);
      }
      
      if (query.limit) {
        sessions.splice(query.limit);
      }
      
      return sessions;
    } catch (error) {
      throw new StorageError(
        'Failed to query sessions',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Create backup of a file
   */
  private async createBackup(type: string, id: string): Promise<void> {
    if (!this.config.enableBackups) return;
    
    try {
      const sourceDir = type === 'sessions' ? this.sessionsDir :
                       type === 'tasks' ? this.tasksDir :
                       type === 'plans' ? this.plansDir :
                       this.verificationsDir;
      
      const sourcePath = path.join(sourceDir, `${id}.json`);
      
      try {
        await fs.access(sourcePath);
      } catch {
        return; // Source file doesn't exist, no backup needed
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupsDir, `${type}-${id}-${timestamp}.json`);
      
      await fs.copyFile(sourcePath, backupPath);
      
      // Clean up old backups
      await this.cleanupBackups(type, id);
    } catch (error) {
      // Log error but don't fail the main operation
      console.warn(`Failed to create backup for ${type}/${id}:`, error);
    }
  }

  /**
   * Clean up old backups
   */
  private async cleanupBackups(type: string, id: string): Promise<void> {
    if (!this.config.maxBackups) return;
    
    try {
      const files = await fs.readdir(this.backupsDir);
      const backupFiles = files
        .filter(file => file.startsWith(`${type}-${id}-`) && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first
      
      if (backupFiles.length > this.config.maxBackups) {
        const filesToDelete = backupFiles.slice(this.config.maxBackups);
        
        for (const file of filesToDelete) {
          await fs.unlink(path.join(this.backupsDir, file));
        }
      }
    } catch (error) {
      console.warn(`Failed to cleanup backups for ${type}/${id}:`, error);
    }
  }

  /**
   * Check if session matches query criteria
   */
  private matchesQuery(session: OrchestrationSession, query: SessionQuery): boolean {
    if (query.orchestrationId && session.orchestrationId !== query.orchestrationId) {
      return false;
    }
    
    if (query.type && session.type !== query.type) {
      return false;
    }
    
    if (query.state && session.state !== query.state) {
      return false;
    }
    
    if (query.taskId && session.taskId !== query.taskId) {
      return false;
    }
    
    if (query.parentSessionId && session.parentSessionId !== query.parentSessionId) {
      return false;
    }
    
    if (query.dateRange) {
      const sessionDate = session.timestamp;
      if (query.dateRange.from && sessionDate < query.dateRange.from) {
        return false;
      }
      if (query.dateRange.to && sessionDate > query.dateRange.to) {
        return false;
      }
    }
    
    if (query.tags && query.tags.length > 0) {
      const sessionTags = session.metadata.tags || [];
      if (!query.tags.some(tag => sessionTags.includes(tag))) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    sessionsCount: number;
    tasksCount: number;
    plansCount: number;
    verificationsCount: number;
    totalSize: number;
  }> {
    try {
      const [sessionFiles, taskFiles, planFiles, verificationFiles] = await Promise.all([
        fs.readdir(this.sessionsDir).catch(() => []),
        fs.readdir(this.tasksDir).catch(() => []),
        fs.readdir(this.plansDir).catch(() => []),
        fs.readdir(this.verificationsDir).catch(() => []),
      ]);
      
      // Calculate total size (simplified)
      let totalSize = 0;
      const allDirs = [this.sessionsDir, this.tasksDir, this.plansDir, this.verificationsDir];
      
      for (const dir of allDirs) {
        try {
          const files = await fs.readdir(dir);
          for (const file of files) {
            const stat = await fs.stat(path.join(dir, file));
            totalSize += stat.size;
          }
        } catch {
          // Ignore errors for individual directories
        }
      }
      
      return {
        sessionsCount: sessionFiles.filter(f => f.endsWith('.json')).length,
        tasksCount: taskFiles.filter(f => f.endsWith('.json')).length,
        plansCount: planFiles.filter(f => f.endsWith('.json')).length,
        verificationsCount: verificationFiles.filter(f => f.endsWith('.json')).length,
        totalSize,
      };
    } catch (error) {
      throw new StorageError(
        'Failed to get storage statistics',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
