/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '@qwen-code/qwen-code-core';
import { StateManager } from '../state/StateManager.js';
import { TaskManifest } from '../state/TaskManifest.js';
import { SessionRegistry } from '../session/SessionRegistry.js';
import { planCommand } from './planCommand.js';
import { newTaskCommand } from './newTaskCommand.js';
import { checkCompletenessCommand } from './checkCompletenessCommand.js';
import { listTasksCommand } from './listTasksCommand.js';
import { taskStatusCommand } from './taskStatusCommand.js';
import { approvePlanCommand } from './approvePlanCommand.js';
import { resetPlanCommand } from './resetPlanCommand.js';
import { exportPlanCommand } from './exportPlanCommand.js';
import { sessionsCommand } from './sessionsCommand.js';
import { resumeCommand } from './resumeCommand.js';
import { contextCommand } from './contextCommand.js';
import { sessionHistoryCommand } from './sessionHistoryCommand.js';
import { orchestrationHelpCommand } from './orchestrationHelpCommand.js';
import { errorHandler, OrchestrationError } from '../utils/ErrorHandler.js';

// Import types from CLI - these will be available when the package is used in the CLI
export interface ICommandLoader {
  loadCommands(signal?: any): Promise<SlashCommand[]>;
}

export interface SlashCommand {
  name: string;
  altNames?: string[];
  description: string;
  kind: CommandKind;
  extensionName?: string;
  action?: (context: CommandContext, args: string) =>
    void | SlashCommandActionReturn | Promise<void | SlashCommandActionReturn>;
  completion?: (context: CommandContext, partialArg: string) => Promise<string[]>;
  subCommands?: SlashCommand[];
}

export enum CommandKind {
  BUILT_IN = 'built-in',
  FILE = 'file',
  MCP_PROMPT = 'mcp-prompt',
  ORCHESTRATION = 'orchestration',
}

export interface CommandContext {
  services: {
    config?: Config;
    settings?: any;
    git?: any;
    logger?: any;
  };
  ui: {
    addItem: (item: any, timestamp: number) => number;
    clear: () => void;
    loadHistory: (history: any[]) => void;
    setDebugMessage: (message: string) => void;
    pendingItem?: any;
    setPendingItem: (item: any) => void;
    toggleCorgiMode: () => void;
    toggleVimEnabled: () => Promise<boolean>;
  };
  session: {
    stats: any;
    resetSession: () => void;
    sessionShellAllowlist: Set<string>;
  };
  invocation?: {
    raw: string;
    name: string;
    args: string;
  };
}

export interface SlashCommandActionReturn {
  type: string;
  [key: string]: any;
}

/**
 * Orchestration context for commands
 */
export interface OrchestrationContext {
  stateManager: StateManager;
  sessionRegistry: SessionRegistry;
  taskManifest: TaskManifest;
  config: Config;
}

/**
 * Orchestration command loader
 */
export class OrchestrationCommandLoader implements ICommandLoader {
  private orchestrationContext: OrchestrationContext;

  constructor(config: Config) {
    // Initialize orchestration context
    const baseDir = this.getOrchestrationDir(config);
    const stateManager = new StateManager({ baseDir });
    const sessionRegistry = new SessionRegistry(stateManager);
    const taskManifest = new TaskManifest(baseDir);

    this.orchestrationContext = {
      stateManager,
      sessionRegistry,
      taskManifest,
      config,
    };
  }

  /**
   * Load all orchestration commands
   */
  async loadCommands(_signal?: any): Promise<SlashCommand[]> {
    // Initialize storage
    await this.orchestrationContext.stateManager.initialize();
    await this.orchestrationContext.sessionRegistry.initialize();
    await this.orchestrationContext.taskManifest.initialize();

    // Create commands with orchestration context
    const commands: SlashCommand[] = [
      this.createCommand(orchestrationHelpCommand),
      this.createCommand(planCommand),
      this.createCommand(newTaskCommand),
      this.createCommand(checkCompletenessCommand),
      this.createCommand(listTasksCommand),
      this.createCommand(taskStatusCommand),
      this.createCommand(approvePlanCommand),
      this.createCommand(resetPlanCommand),
      this.createCommand(exportPlanCommand),
      this.createCommand(sessionsCommand),
      this.createCommand(resumeCommand),
      this.createCommand(contextCommand),
      this.createCommand(sessionHistoryCommand),
    ];

    return commands;
  }

  /**
   * Create command with orchestration context injection
   */
  private createCommand(commandFactory: (context: OrchestrationContext) => SlashCommand): SlashCommand {
    return commandFactory(this.orchestrationContext);
  }

  /**
   * Get orchestration directory path
   */
  private getOrchestrationDir(config: Config): string {
    const projectRoot = config.getProjectRoot();
    return `${projectRoot}/.qwen/orchestration`;
  }
}

/**
 * Factory function to create orchestration command loader
 */
export function createOrchestrationCommandLoader(config: Config): OrchestrationCommandLoader {
  return new OrchestrationCommandLoader(config);
}

/**
 * Helper function to create orchestration command action with error handling
 */
export function createOrchestrationAction(
  action: (context: OrchestrationContext, commandContext: CommandContext, args: string) =>
    void | SlashCommandActionReturn | Promise<void | SlashCommandActionReturn>
) {
  return (orchestrationContext: OrchestrationContext) =>
    async (commandContext: CommandContext, args: string) => {
      try {
        return await action(orchestrationContext, commandContext, args);
      } catch (error) {
        // Handle orchestration errors with recovery
        const recoveryResult = await errorHandler.handleError(error as Error);

        if (recoveryResult.success) {
          addInfoMessage(commandContext, recoveryResult.message);
        } else {
          addErrorMessage(commandContext, recoveryResult.message);

          // Show recovery actions if available
          if (recoveryResult.actions && recoveryResult.actions.length > 0) {
            const actionLines = ['**Suggested Recovery Actions:**', ''];
            for (const action of recoveryResult.actions) {
              const priorityIcon = action.priority === 'critical' ? '🔴' :
                                 action.priority === 'high' ? '🟠' :
                                 action.priority === 'medium' ? '🟡' : '🔵';

              actionLines.push(`${priorityIcon} **${action.description}**`);
              if (action.command) {
                actionLines.push(`   Command: \`${action.command}\``);
              }
              actionLines.push('');
            }

            addInfoMessage(commandContext, actionLines.join('\n'));
          }
        }
      }
    };
}

/**
 * Message types for UI integration
 */
export enum MessageType {
  USER = 'user',
  GEMINI = 'gemini',
  INFO = 'info',
  ERROR = 'error',
  TOOL_CALL = 'tool_call',
}

/**
 * Helper function to add info message to UI
 */
export function addInfoMessage(context: CommandContext, message: string): void {
  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: message,
    },
    Date.now()
  );
}

/**
 * Helper function to add error message to UI
 */
export function addErrorMessage(context: CommandContext, message: string): void {
  context.ui.addItem(
    {
      type: MessageType.ERROR,
      text: message,
    },
    Date.now()
  );
}

/**
 * Helper function to format orchestration status
 */
export function formatOrchestrationStatus(
  sessionsCount: number,
  tasksCount: number,
  completedTasks: number
): string {
  const completionPercentage = tasksCount > 0 ? Math.round((completedTasks / tasksCount) * 100) : 0;
  
  return `**Orchestration Status**
- Sessions: ${sessionsCount}
- Tasks: ${completedTasks}/${tasksCount} (${completionPercentage}% complete)`;
}

/**
 * Helper function to format task list
 */
export function formatTaskList(tasks: any[]): string {
  if (tasks.length === 0) {
    return 'No tasks found.';
  }

  const taskLines = tasks.map((task, index) => {
    const statusIcon = task.status === 'completed' ? '✅' : 
                      task.status === 'in_progress' ? '🔄' : 
                      task.status === 'blocked' ? '🚫' : '⏳';
    
    return `${index + 1}. ${statusIcon} **${task.name}** (${task.status})
   ${task.description}`;
  });

  return `**Tasks:**\n${taskLines.join('\n\n')}`;
}

/**
 * Helper function to format session list
 */
export function formatSessionList(sessions: any[]): string {
  if (sessions.length === 0) {
    return 'No sessions found.';
  }

  const sessionLines = sessions.map((session, index) => {
    const typeIcon = session.type === 'planning' ? '📋' : 
                    session.type === 'task' ? '⚡' : 
                    session.type === 'verification' ? '✅' : '💬';
    
    const stateIcon = session.state === 'active' ? '🟢' : 
                     session.state === 'completed' ? '✅' : 
                     session.state === 'suspended' ? '⏸️' : '❌';
    
    return `${index + 1}. ${typeIcon} ${stateIcon} **${session.type}** (${session.id.slice(0, 8)})
   ${session.context.currentFocus}
   *${new Date(session.timestamp).toLocaleString()}*`;
  });

  return `**Sessions:**\n${sessionLines.join('\n\n')}`;
}
