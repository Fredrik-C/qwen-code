/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SlashCommand,
  CommandKind,
  OrchestrationContext,
  CommandContext,
  addInfoMessage,
  addErrorMessage
} from './OrchestrationCommandLoader.js';
import { TaskExecutor } from '../execution/TaskExecutor.js';
import { ContextLoader } from '../session/ContextLoader.js';
import { SessionType, CreateSessionParams } from '../types/session.js';
import { TaskStatus } from '../types/task.js';

/**
 * Parse new task command arguments
 */
function parseNewTaskArgs(args: string): {
  taskId?: string;
  orchestrationId?: string;
  force?: boolean;
  skipVerification?: boolean;
  help?: boolean;
} {
  const result: any = {};

  if (!args || args.trim() === '' || args.includes('--help') || args.includes('-h')) {
    result.help = true;
    return result;
  }

  // Parse arguments
  const argParts = args.split(/\s+/);

  for (let i = 0; i < argParts.length; i++) {
    const arg = argParts[i];

    if (arg === '--force' || arg === '-f') {
      result.force = true;
    } else if (arg === '--skip-verification') {
      result.skipVerification = true;
    } else if (arg === '--orchestration' || arg === '--orch') {
      result.orchestrationId = argParts[++i];
    } else if (arg === '--task') {
      result.taskId = argParts[++i];
    } else if (!arg.startsWith('--') && !result.taskId) {
      // First non-flag argument is task ID
      result.taskId = arg;
    }
  }

  return result;
}

/**
 * /new_task command - Implement next task in sequence
 */
export function newTaskCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'new_task',
    description: 'Implement next task in sequence with fresh session',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseNewTaskArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**New Task Command Usage:**

\`/new_task [task_id]\`

**Options:**
- \`--orchestration <id>\` - Specify orchestration ID
- \`--task <id>\` - Specify specific task ID to implement
- \`--force\` - Force task execution even if dependencies aren't met
- \`--skip-verification\` - Skip verification phase
- \`--help\` - Show this help message

**Examples:**
\`/new_task\` - Implement next available task
\`/new_task task-123\` - Implement specific task
\`/new_task --orchestration orch-456\` - Next task from specific orchestration

**Process:**
1. Identifies next task to implement
2. Creates fresh implementation session
3. Loads selective context from planning
4. Executes task with focused approach
5. Runs verification in separate session
6. Updates task status and progress

**Prerequisites:**
- Active orchestration with approved plan
- Available tasks in NOT_STARTED status
- Dependencies satisfied (unless --force used)`);
          return;
        }

        // Get orchestration ID
        let orchestrationId = parsedArgs.orchestrationId ||
                             commandContext.session.stats.orchestrationId;

        if (!orchestrationId) {
          addErrorMessage(commandContext, `❌ **No Active Orchestration**

No orchestration ID found. Please:
1. Run \`/plan\` to create a new plan, or
2. Use \`/sessions\` to find existing orchestrations, or
3. Specify orchestration ID with \`--orchestration <id>\`

Use \`/new_task --help\` for more information.`);
          return;
        }

        addInfoMessage(commandContext, `🔍 **Finding Next Task**

Orchestration ID: ${orchestrationId}
${parsedArgs.taskId ? `Specific Task: ${parsedArgs.taskId}` : 'Finding next available task...'}

Analyzing task dependencies and status...`);

        // Create task executor
        const contextLoader = new ContextLoader(
          context.sessionRegistry,
          context.taskManifest
        );

        const taskExecutor = new TaskExecutor(
          context.sessionRegistry,
          context.taskManifest,
          contextLoader
        );

        // Find or load the task to execute
        let taskToExecute;

        if (parsedArgs.taskId) {
          taskToExecute = await context.taskManifest.loadTask(parsedArgs.taskId);
          if (!taskToExecute) {
            addErrorMessage(commandContext, `❌ **Task Not Found**

Task ID "${parsedArgs.taskId}" does not exist.

Use \`/list_tasks\` to see available tasks.`);
            return;
          }
        } else {
          taskToExecute = await context.taskManifest.getNextTask(orchestrationId);
          if (!taskToExecute) {
            addInfoMessage(commandContext, `✅ **No Tasks Available**

All tasks in orchestration "${orchestrationId}" are either completed or in progress.

Use \`/list_tasks\` to see current status or \`/check_completeness\` to verify project completion.`);
            return;
          }
        }

        // Validate task can be executed
        if (taskToExecute.status !== TaskStatus.NOT_STARTED && !parsedArgs.force) {
          addErrorMessage(commandContext, `❌ **Task Already Started**

Task "${taskToExecute.name}" has status: ${taskToExecute.status}

Use \`--force\` to override this check or select a different task.`);
          return;
        }

        // Check dependencies
        if (taskToExecute.dependencies.length > 0 && !parsedArgs.force) {
          const dependencyCheck = await taskExecutor.checkDependencies(taskToExecute.id);
          if (!dependencyCheck.allSatisfied) {
            addErrorMessage(commandContext, `❌ **Dependencies Not Satisfied**

Task "${taskToExecute.name}" has unsatisfied dependencies:
${dependencyCheck.unsatisfiedDependencies.map(dep => `• ${dep.taskId} (${dep.type})`).join('\n')}

Complete dependent tasks first or use \`--force\` to override.`);
            return;
          }
        }

        addInfoMessage(commandContext, `🚀 **Starting Task Implementation**

**Task:** ${taskToExecute.name}
**Description:** ${taskToExecute.description}
**Priority:** ${taskToExecute.priority}
**Estimated Effort:** ${taskToExecute.estimation?.effortHours || 'Not specified'} hours

Creating fresh implementation session for focused execution...`);

        // Execute the task
        const executionResult = await taskExecutor.executeTask(
          taskToExecute.id,
          {
            createFreshSession: true,
            loadPlanningContext: true,
            skipVerification: parsedArgs.skipVerification || false,
            forceExecution: parsedArgs.force || false,
          }
        );

        if (executionResult.success) {
          addInfoMessage(commandContext, `✅ **Task Implementation Started**

**Session ID:** ${executionResult.sessionId}
**Task Status:** ${executionResult.taskStatus}
${executionResult.verificationSessionId ? `**Verification Session:** ${executionResult.verificationSessionId}` : ''}

${executionResult.warnings.length > 0 ? `**Warnings:**\n${executionResult.warnings.map(w => `⚠️ ${w}`).join('\n')}\n` : ''}

**Context Loaded:**
• Planning context: ${executionResult.contextLoaded?.planningContext ? '✅' : '❌'}
• Task specifications: ${executionResult.contextLoaded?.taskSpecs ? '✅' : '❌'}
• Dependencies: ${executionResult.contextLoaded?.dependencies ? '✅' : '❌'}

**Next Steps:**
${executionResult.nextSteps.map(step => `• ${step}`).join('\n')}

The implementation session is now active. You can continue working on the task in this focused context.`);

          // Update session stats
          commandContext.session.stats.currentTaskId = taskToExecute.id;
          commandContext.session.stats.currentSessionId = executionResult.sessionId;

        } else {
          addErrorMessage(commandContext, `❌ **Task Implementation Failed**

${executionResult.errors.map(error => `• ${error}`).join('\n')}

${executionResult.warnings.length > 0 ? `\n**Warnings:**\n${executionResult.warnings.map(w => `⚠️ ${w}`).join('\n')}` : ''}

Please address the issues above and try again.`);
        }

      } catch (error) {
        addErrorMessage(commandContext, `Task execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
