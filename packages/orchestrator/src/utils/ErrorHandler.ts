/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Orchestration-specific error types
 */
export enum OrchestrationErrorType {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_CORRUPTED = 'SESSION_CORRUPTED',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  PLAN_NOT_FOUND = 'PLAN_NOT_FOUND',
  STORAGE_ERROR = 'STORAGE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',
  STATE_TRANSITION_ERROR = 'STATE_TRANSITION_ERROR',
  CONTEXT_LOADING_ERROR = 'CONTEXT_LOADING_ERROR',
  THINKING_ERROR = 'THINKING_ERROR',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  VERIFICATION_ERROR = 'VERIFICATION_ERROR',
}

/**
 * Base orchestration error class
 */
export class OrchestrationError extends Error {
  public readonly type: OrchestrationErrorType;
  public readonly context?: Record<string, any>;
  public readonly recoverable: boolean;
  public readonly timestamp: Date;

  constructor(
    type: OrchestrationErrorType,
    message: string,
    context?: Record<string, any>,
    recoverable: boolean = true
  ) {
    super(message);
    this.name = 'OrchestrationError';
    this.type = type;
    this.context = context;
    this.recoverable = recoverable;
    this.timestamp = new Date();
  }

  /**
   * Create a formatted error message for display
   */
  toDisplayMessage(): string {
    const lines = [
      `❌ **${this.type.replace(/_/g, ' ')}**`,
      '',
      this.message,
    ];

    if (this.context) {
      lines.push('');
      lines.push('**Context:**');
      for (const [key, value] of Object.entries(this.context)) {
        lines.push(`• ${key}: ${value}`);
      }
    }

    if (this.recoverable) {
      lines.push('');
      lines.push('💡 This error is recoverable. Try the suggested recovery actions.');
    }

    return lines.join('\n');
  }
}

/**
 * Recovery action interface
 */
export interface RecoveryAction {
  id: string;
  description: string;
  command?: string;
  automatic: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Recovery result interface
 */
export interface RecoveryResult {
  success: boolean;
  message: string;
  actions?: RecoveryAction[];
}

/**
 * Error handler with recovery mechanisms
 */
export class ErrorHandler {
  private recoveryStrategies: Map<OrchestrationErrorType, (error: OrchestrationError) => Promise<RecoveryResult>>;

  constructor() {
    this.recoveryStrategies = new Map();
    this.initializeRecoveryStrategies();
  }

  /**
   * Handle an error and attempt recovery
   */
  async handleError(error: Error | OrchestrationError): Promise<RecoveryResult> {
    // Convert regular errors to OrchestrationError
    const orchError = error instanceof OrchestrationError ? 
      error : 
      new OrchestrationError(
        OrchestrationErrorType.EXECUTION_ERROR,
        error.message,
        { originalError: error.name }
      );

    console.error(`[OrchestrationError] ${orchError.type}: ${orchError.message}`, orchError.context);

    // Attempt recovery if strategy exists
    const recoveryStrategy = this.recoveryStrategies.get(orchError.type);
    if (recoveryStrategy && orchError.recoverable) {
      try {
        return await recoveryStrategy(orchError);
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError);
        return {
          success: false,
          message: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
        };
      }
    }

    // No recovery strategy available
    return {
      success: false,
      message: orchError.toDisplayMessage(),
      actions: this.getGenericRecoveryActions(orchError.type),
    };
  }

  /**
   * Initialize recovery strategies for different error types
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies.set(
      OrchestrationErrorType.SESSION_NOT_FOUND,
      this.recoverSessionNotFound.bind(this)
    );

    this.recoveryStrategies.set(
      OrchestrationErrorType.SESSION_CORRUPTED,
      this.recoverSessionCorrupted.bind(this)
    );

    this.recoveryStrategies.set(
      OrchestrationErrorType.STORAGE_ERROR,
      this.recoverStorageError.bind(this)
    );

    this.recoveryStrategies.set(
      OrchestrationErrorType.VALIDATION_ERROR,
      this.recoverValidationError.bind(this)
    );

    this.recoveryStrategies.set(
      OrchestrationErrorType.STATE_TRANSITION_ERROR,
      this.recoverStateTransitionError.bind(this)
    );
  }

  /**
   * Recover from session not found error
   */
  private async recoverSessionNotFound(error: OrchestrationError): Promise<RecoveryResult> {
    return {
      success: false,
      message: 'Session not found. Consider creating a new session or checking available sessions.',
      actions: [
        {
          id: 'list_sessions',
          description: 'List available sessions',
          command: '/sessions',
          automatic: false,
          priority: 'high',
        },
        {
          id: 'create_plan',
          description: 'Create a new planning session',
          command: '/plan',
          automatic: false,
          priority: 'medium',
        },
      ],
    };
  }

  /**
   * Recover from session corruption
   */
  private async recoverSessionCorrupted(error: OrchestrationError): Promise<RecoveryResult> {
    return {
      success: false,
      message: 'Session data is corrupted. Consider restoring from backup or creating a new session.',
      actions: [
        {
          id: 'backup_restore',
          description: 'Attempt to restore from backup',
          automatic: false,
          priority: 'high',
        },
        {
          id: 'create_new_session',
          description: 'Create a new session',
          command: '/plan',
          automatic: false,
          priority: 'medium',
        },
        {
          id: 'cleanup_corrupted',
          description: 'Remove corrupted session data',
          command: '/sessions --cleanup',
          automatic: false,
          priority: 'low',
        },
      ],
    };
  }

  /**
   * Recover from storage errors
   */
  private async recoverStorageError(error: OrchestrationError): Promise<RecoveryResult> {
    return {
      success: false,
      message: 'Storage operation failed. Check disk space and permissions.',
      actions: [
        {
          id: 'check_permissions',
          description: 'Check file system permissions',
          automatic: false,
          priority: 'high',
        },
        {
          id: 'check_disk_space',
          description: 'Check available disk space',
          automatic: false,
          priority: 'high',
        },
        {
          id: 'retry_operation',
          description: 'Retry the failed operation',
          automatic: false,
          priority: 'medium',
        },
      ],
    };
  }

  /**
   * Recover from validation errors
   */
  private async recoverValidationError(error: OrchestrationError): Promise<RecoveryResult> {
    return {
      success: false,
      message: 'Data validation failed. Check input parameters and try again.',
      actions: [
        {
          id: 'check_input',
          description: 'Verify input parameters',
          automatic: false,
          priority: 'high',
        },
        {
          id: 'reset_state',
          description: 'Reset to a known good state',
          automatic: false,
          priority: 'medium',
        },
      ],
    };
  }

  /**
   * Recover from state transition errors
   */
  private async recoverStateTransitionError(error: OrchestrationError): Promise<RecoveryResult> {
    return {
      success: false,
      message: 'Invalid state transition. Check current state and try again.',
      actions: [
        {
          id: 'check_state',
          description: 'Check current session state',
          command: '/context',
          automatic: false,
          priority: 'high',
        },
        {
          id: 'force_transition',
          description: 'Force state transition (use with caution)',
          automatic: false,
          priority: 'low',
        },
      ],
    };
  }

  /**
   * Get generic recovery actions for unknown error types
   */
  private getGenericRecoveryActions(errorType: OrchestrationErrorType): RecoveryAction[] {
    return [
      {
        id: 'check_status',
        description: 'Check current orchestration status',
        command: '/task_status',
        automatic: false,
        priority: 'medium',
      },
      {
        id: 'list_sessions',
        description: 'List available sessions',
        command: '/sessions',
        automatic: false,
        priority: 'medium',
      },
      {
        id: 'get_help',
        description: 'Get help for orchestration commands',
        command: '/orchestration_help',
        automatic: false,
        priority: 'low',
      },
    ];
  }
}

/**
 * Global error handler instance
 */
export const errorHandler = new ErrorHandler();

/**
 * Utility function to create specific error types
 */
export const createOrchestrationError = {
  sessionNotFound: (sessionId: string) => new OrchestrationError(
    OrchestrationErrorType.SESSION_NOT_FOUND,
    `Session "${sessionId}" not found`,
    { sessionId }
  ),

  sessionCorrupted: (sessionId: string, details?: string) => new OrchestrationError(
    OrchestrationErrorType.SESSION_CORRUPTED,
    `Session "${sessionId}" data is corrupted${details ? `: ${details}` : ''}`,
    { sessionId, details },
    true
  ),

  taskNotFound: (taskId: string) => new OrchestrationError(
    OrchestrationErrorType.TASK_NOT_FOUND,
    `Task "${taskId}" not found`,
    { taskId }
  ),

  planNotFound: (orchestrationId: string) => new OrchestrationError(
    OrchestrationErrorType.PLAN_NOT_FOUND,
    `Plan for orchestration "${orchestrationId}" not found`,
    { orchestrationId }
  ),

  storageError: (operation: string, details: string) => new OrchestrationError(
    OrchestrationErrorType.STORAGE_ERROR,
    `Storage operation "${operation}" failed: ${details}`,
    { operation, details }
  ),

  validationError: (field: string, value: any, reason: string) => new OrchestrationError(
    OrchestrationErrorType.VALIDATION_ERROR,
    `Validation failed for ${field}: ${reason}`,
    { field, value, reason }
  ),

  stateTransitionError: (from: string, to: string, reason: string) => new OrchestrationError(
    OrchestrationErrorType.STATE_TRANSITION_ERROR,
    `Invalid state transition from ${from} to ${to}: ${reason}`,
    { from, to, reason }
  ),
};


