/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ValidationUtils } from './ValidationUtils.js';
import { createOrchestrationError, OrchestrationError } from './ErrorHandler.js';
import { SessionState, SessionType } from '../types/session.js';
import { TaskStatus, TaskPriority } from '../types/task.js';

/**
 * Data recovery result interface
 */
export interface DataRecoveryResult {
  success: boolean;
  message: string;
  recoveredData?: any;
  backupCreated?: string;
  errors?: string[];
}

/**
 * Backup metadata interface
 */
export interface BackupMetadata {
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  reason: string;
  size: number;
}

/**
 * Recovery utilities for handling corrupted data and state
 */
export class RecoveryUtils {
  private static readonly BACKUP_DIR = '.qwen/orchestration/backups';
  private static readonly MAX_BACKUPS = 10;

  /**
   * Create a backup of a file before attempting recovery
   */
  static async createBackup(filePath: string, reason: string): Promise<BackupMetadata> {
    try {
      const backupDir = path.join(path.dirname(filePath), '..', 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = path.basename(filePath);
      const backupFileName = `${fileName}.${timestamp}.backup`;
      const backupPath = path.join(backupDir, backupFileName);

      const data = await fs.readFile(filePath);
      await fs.writeFile(backupPath, data);

      const stats = await fs.stat(backupPath);

      const metadata: BackupMetadata = {
        originalPath: filePath,
        backupPath,
        timestamp: new Date(),
        reason,
        size: stats.size,
      };

      // Save backup metadata
      const metadataPath = backupPath + '.meta';
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      // Clean up old backups
      await this.cleanupOldBackups(backupDir);

      return metadata;
    } catch (error) {
      throw createOrchestrationError.storageError(
        'backup creation',
        `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Attempt to recover a corrupted session file
   */
  static async recoverSessionFile(filePath: string): Promise<DataRecoveryResult> {
    try {
      // Create backup first
      const backup = await this.createBackup(filePath, 'Session recovery attempt');

      // Try to read and parse the file
      const rawData = await fs.readFile(filePath, 'utf-8');
      
      let sessionData: any;
      try {
        sessionData = JSON.parse(rawData);
      } catch (parseError) {
        // Try to fix common JSON issues
        const fixedData = this.fixCommonJsonIssues(rawData);
        try {
          sessionData = JSON.parse(fixedData);
        } catch (secondParseError) {
          return {
            success: false,
            message: 'Unable to parse session data as JSON',
            backupCreated: backup.backupPath,
            errors: [String(parseError), String(secondParseError)],
          };
        }
      }

      // Validate and fix session data
      const recoveredSession = this.recoverSessionData(sessionData);
      const validation = ValidationUtils.validateSession(recoveredSession);

      if (!validation.isValid) {
        return {
          success: false,
          message: 'Session data validation failed after recovery attempt',
          backupCreated: backup.backupPath,
          errors: validation.errors,
        };
      }

      // Write recovered data back to file
      await fs.writeFile(filePath, JSON.stringify(validation.session, null, 2));

      return {
        success: true,
        message: 'Session file successfully recovered',
        recoveredData: validation.session,
        backupCreated: backup.backupPath,
      };

    } catch (error) {
      return {
        success: false,
        message: `Recovery failed: ${error instanceof Error ? error.message : String(error)}`,
        errors: [String(error)],
      };
    }
  }

  /**
   * Attempt to recover a corrupted task manifest file
   */
  static async recoverTaskManifestFile(filePath: string): Promise<DataRecoveryResult> {
    try {
      // Create backup first
      const backup = await this.createBackup(filePath, 'Task manifest recovery attempt');

      // Try to read and parse the file
      const rawData = await fs.readFile(filePath, 'utf-8');
      
      let manifestData: any;
      try {
        manifestData = JSON.parse(rawData);
      } catch (parseError) {
        // Try to fix common JSON issues
        const fixedData = this.fixCommonJsonIssues(rawData);
        try {
          manifestData = JSON.parse(fixedData);
        } catch (secondParseError) {
          return {
            success: false,
            message: 'Unable to parse task manifest data as JSON',
            backupCreated: backup.backupPath,
            errors: [String(parseError), String(secondParseError)],
          };
        }
      }

      // Validate and fix task data
      const recoveredManifest = this.recoverTaskManifestData(manifestData);

      // Write recovered data back to file
      await fs.writeFile(filePath, JSON.stringify(recoveredManifest, null, 2));

      return {
        success: true,
        message: 'Task manifest file successfully recovered',
        recoveredData: recoveredManifest,
        backupCreated: backup.backupPath,
      };

    } catch (error) {
      return {
        success: false,
        message: `Recovery failed: ${error instanceof Error ? error.message : String(error)}`,
        errors: [String(error)],
      };
    }
  }

  /**
   * Fix common JSON parsing issues
   */
  private static fixCommonJsonIssues(jsonString: string): string {
    let fixed = jsonString;

    // Remove trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // Fix unescaped quotes in strings
    fixed = fixed.replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1\\"$2\\"$3":');

    // Remove comments (if any)
    fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
    fixed = fixed.replace(/\/\/.*$/gm, '');

    // Fix missing quotes around property names
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

    return fixed;
  }

  /**
   * Recover session data by filling in missing or invalid fields
   */
  private static recoverSessionData(data: any): any {
    const recovered = { ...data };

    // Ensure required fields exist
    if (!recovered.id) {
      recovered.id = `session-${Date.now()}-recovered`;
    }

    if (!recovered.type || !Object.values(SessionType).includes(recovered.type)) {
      recovered.type = SessionType.INTERACTIVE;
    }

    if (!recovered.state || !Object.values(SessionState).includes(recovered.state)) {
      recovered.state = SessionState.SUSPENDED;
    }

    if (!recovered.orchestrationId) {
      recovered.orchestrationId = `orch-${Date.now()}-recovered`;
    }

    if (!recovered.startTime) {
      recovered.startTime = new Date();
    } else if (typeof recovered.startTime === 'string') {
      recovered.startTime = new Date(recovered.startTime);
    }

    if (recovered.endTime && typeof recovered.endTime === 'string') {
      recovered.endTime = new Date(recovered.endTime);
    }

    // Ensure arrays exist
    if (!Array.isArray(recovered.childSessionIds)) {
      recovered.childSessionIds = [];
    }

    // Ensure context object exists
    if (!recovered.context || typeof recovered.context !== 'object') {
      recovered.context = {};
    }

    if (!Array.isArray(recovered.context.nextSteps)) {
      recovered.context.nextSteps = [];
    }

    if (!Array.isArray(recovered.context.decisions)) {
      recovered.context.decisions = [];
    }

    // Ensure metadata object exists
    if (!recovered.metadata || typeof recovered.metadata !== 'object') {
      recovered.metadata = {};
    }

    if (!Array.isArray(recovered.metadata.tags)) {
      recovered.metadata.tags = [];
    }

    return recovered;
  }

  /**
   * Recover task manifest data by fixing invalid tasks
   */
  private static recoverTaskManifestData(data: any): any {
    const recovered = { ...data };

    // Ensure tasks array exists
    if (!Array.isArray(recovered.tasks)) {
      recovered.tasks = [];
    }

    // Fix each task
    recovered.tasks = recovered.tasks.map((task: any) => this.recoverTaskData(task));

    // Ensure plans array exists
    if (!Array.isArray(recovered.plans)) {
      recovered.plans = [];
    }

    return recovered;
  }

  /**
   * Recover individual task data
   */
  private static recoverTaskData(data: any): any {
    const recovered = { ...data };

    // Ensure required fields exist
    if (!recovered.id) {
      recovered.id = `task-${Date.now()}-recovered`;
    }

    if (!recovered.name) {
      recovered.name = 'Recovered Task';
    }

    if (!recovered.description) {
      recovered.description = 'Task recovered from corrupted data';
    }

    if (!recovered.status || !Object.values(TaskStatus).includes(recovered.status)) {
      recovered.status = TaskStatus.NOT_STARTED;
    }

    if (!recovered.priority || !Object.values(TaskPriority).includes(recovered.priority)) {
      recovered.priority = TaskPriority.MEDIUM;
    }

    if (!recovered.orchestrationId) {
      recovered.orchestrationId = `orch-${Date.now()}-recovered`;
    }

    // Ensure arrays exist
    if (!Array.isArray(recovered.dependencies)) {
      recovered.dependencies = [];
    }

    if (!Array.isArray(recovered.acceptanceCriteria)) {
      recovered.acceptanceCriteria = [];
    }

    // Ensure progress object exists
    if (!recovered.progress || typeof recovered.progress !== 'object') {
      recovered.progress = {
        completionPercentage: 0,
      };
    }

    if (typeof recovered.progress.completionPercentage !== 'number') {
      recovered.progress.completionPercentage = 0;
    }

    // Ensure dates exist
    if (!recovered.createdAt) {
      recovered.createdAt = new Date();
    } else if (typeof recovered.createdAt === 'string') {
      recovered.createdAt = new Date(recovered.createdAt);
    }

    if (!recovered.updatedAt) {
      recovered.updatedAt = new Date();
    } else if (typeof recovered.updatedAt === 'string') {
      recovered.updatedAt = new Date(recovered.updatedAt);
    }

    return recovered;
  }

  /**
   * Clean up old backup files
   */
  private static async cleanupOldBackups(backupDir: string): Promise<void> {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(f => f.endsWith('.backup'));

      if (backupFiles.length <= this.MAX_BACKUPS) {
        return;
      }

      // Sort by modification time and remove oldest
      const fileStats = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime };
        })
      );

      fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      const filesToRemove = fileStats.slice(0, fileStats.length - this.MAX_BACKUPS);
      
      for (const { file } of filesToRemove) {
        const filePath = path.join(backupDir, file);
        const metaPath = filePath + '.meta';
        
        await fs.unlink(filePath);
        try {
          await fs.unlink(metaPath);
        } catch {
          // Ignore if meta file doesn't exist
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
    }
  }

  /**
   * List available backups for a file
   */
  static async listBackups(originalPath: string): Promise<BackupMetadata[]> {
    try {
      const backupDir = path.join(path.dirname(originalPath), '..', 'backups');
      const fileName = path.basename(originalPath);
      
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(f => f.startsWith(fileName) && f.endsWith('.backup'));

      const backups: BackupMetadata[] = [];
      
      for (const file of backupFiles) {
        const metaPath = path.join(backupDir, file + '.meta');
        try {
          const metaData = await fs.readFile(metaPath, 'utf-8');
          const metadata = JSON.parse(metaData);
          backups.push(metadata);
        } catch {
          // If no metadata, create basic info
          const stats = await fs.stat(path.join(backupDir, file));
          backups.push({
            originalPath,
            backupPath: path.join(backupDir, file),
            timestamp: stats.mtime,
            reason: 'Unknown',
            size: stats.size,
          });
        }
      }

      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      return [];
    }
  }

  /**
   * Restore from a specific backup
   */
  static async restoreFromBackup(backupPath: string, targetPath: string): Promise<DataRecoveryResult> {
    try {
      // Create backup of current file before restoring
      const currentBackup = await this.createBackup(targetPath, 'Pre-restore backup');

      // Copy backup to target location
      const backupData = await fs.readFile(backupPath);
      await fs.writeFile(targetPath, backupData);

      return {
        success: true,
        message: 'Successfully restored from backup',
        backupCreated: currentBackup.backupPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Restore failed: ${error instanceof Error ? error.message : String(error)}`,
        errors: [String(error)],
      };
    }
  }
}
