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
import { PlanStatus, PlanningPhase } from '../types/planning.js';
import { TaskStatus } from '../types/task.js';
import { SessionState } from '../types/session.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Parse reset plan command arguments
 */
function parseResetPlanArgs(args: string): {
  orchestrationId?: string;
  confirm?: boolean;
  preserveRequirements?: boolean;
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

    if (arg === '--confirm' || arg === '-y') {
      result.confirm = true;
    } else if (arg === '--preserve-requirements' || arg === '--preserve') {
      result.preserveRequirements = true;
    } else if (arg === '--orchestration' || arg === '--orch') {
      result.orchestrationId = argParts[++i];
    } else if (!arg.startsWith('--') && !result.orchestrationId) {
      // First non-flag argument is orchestration ID
      result.orchestrationId = arg;
    }
  }

  return result;
}

/**
 * /reset_plan command - Reset orchestration state
 */
export function resetPlanCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'reset_plan',
    description: 'Reset orchestration state and allow fresh planning',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseResetPlanArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**Reset Plan Command Usage:**

\`/reset_plan [orchestration_id]\`

**Options:**
- \`--orchestration <id>\` - Specify orchestration ID to reset
- \`--confirm\` - Skip confirmation prompt (use with caution)
- \`--preserve-requirements\` - Keep original requirements when resetting
- \`--help\` - Show this help message

**Examples:**
\`/reset_plan\` - Reset current orchestration (with confirmation)
\`/reset_plan orch-123\` - Reset specific orchestration
\`/reset_plan --confirm --preserve-requirements\` - Reset keeping requirements

**⚠️ WARNING: This is a destructive operation!**

**What gets reset:**
- Plan status returns to DRAFT
- All task progress is cleared
- Task statuses reset to NOT_STARTED
- Active sessions are suspended
- Planning phase resets to requirements analysis

**What is preserved:**
- Original requirements (if --preserve-requirements used)
- Backup files are created automatically
- Session history for recovery

**Process:**
1. Creates backup of current state
2. Resets plan and task statuses
3. Suspends active sessions
4. Clears progress tracking
5. Enables fresh planning iteration`);
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

Use \`/reset_plan --help\` for more information.`);
          return;
        }

        // Load the current plan
        const plan = await context.taskManifest.loadPlan(orchestrationId);
        if (!plan) {
          addErrorMessage(commandContext, `❌ **Plan Not Found**

No plan found for orchestration "${orchestrationId}".

Please ensure:
1. The orchestration ID is correct
2. A plan has been created using \`/plan\`
3. The plan files are accessible

Use \`/sessions\` to see available orchestrations.`);
          return;
        }

        // Get task statistics for confirmation
        const taskStats = await context.taskManifest.getTaskStatistics(orchestrationId);
        const hasProgress = taskStats.byStatus[TaskStatus.IN_PROGRESS] > 0 || taskStats.byStatus[TaskStatus.COMPLETED] > 0;

        // Show confirmation unless --confirm flag is used
        if (!parsedArgs.confirm) {
          addInfoMessage(commandContext, `⚠️ **Confirm Plan Reset**

**Plan:** ${plan.name}
**Status:** ${plan.status}
**Tasks:** ${taskStats.total} total (${taskStats.byStatus[TaskStatus.COMPLETED]} completed, ${taskStats.byStatus[TaskStatus.IN_PROGRESS]} in progress)
**Requirements:** ${plan.requirements.length}

${hasProgress ? `**⚠️ WARNING: This will lose progress on ${taskStats.byStatus[TaskStatus.COMPLETED] + taskStats.byStatus[TaskStatus.IN_PROGRESS]} tasks!**\n` : ''}

**This will:**
- Reset plan status to DRAFT
- Clear all task progress
- Suspend active sessions
- Create backup for recovery

${parsedArgs.preserveRequirements ? '**Requirements will be preserved**\n' : '**Requirements will also be reset**\n'}

**To proceed, run:**
\`/reset_plan --confirm${parsedArgs.preserveRequirements ? ' --preserve-requirements' : ''}\`

**To cancel:** Simply run a different command or ignore this message.`);
          return;
        }

        addInfoMessage(commandContext, `🔄 **Resetting Plan State**

Orchestration ID: ${orchestrationId}
Plan: ${plan.name}

Creating backup and resetting state...`);

        // Create backup before reset
        try {
          // Note: createBackup is private, but we'll create a manual backup
          // This is a workaround until the StateManager API is updated
          const projectRoot = context.config.getProjectRoot();
          const baseDir = `${projectRoot}/.qwen/orchestration`;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupPath = path.join(baseDir, 'backups', `plan-${orchestrationId}-${timestamp}.json`);

          // Ensure backup directory exists
          await fs.mkdir(path.dirname(backupPath), { recursive: true });

          // Save current plan as backup
          const planData = JSON.stringify(plan, null, 2);
          await fs.writeFile(backupPath, planData, 'utf-8');
          addInfoMessage(commandContext, `✅ **Backup Created**

Plan backup created successfully for recovery if needed.`);
        } catch (error) {
          addErrorMessage(commandContext, `⚠️ **Backup Warning**

Failed to create backup: ${error instanceof Error ? error.message : String(error)}

Continue with reset? Use \`/reset_plan --help\` to see options.`);
          return;
        }

        // Reset plan status
        const resetPlanData: any = {
          status: PlanStatus.DRAFT,
          currentPhase: PlanningPhase.REQUIREMENTS_ANALYSIS,
          metadata: {
            ...plan.metadata,
            resetAt: new Date().toISOString(),
            resetViaCommand: true,
            previousStatus: plan.status,
          },
        };

        // Preserve requirements if requested
        if (!parsedArgs.preserveRequirements) {
          resetPlanData.requirements = [];
          resetPlanData.phases = [];
        }

        const updatedPlan = await context.taskManifest.updatePlan(orchestrationId, resetPlanData);
        if (!updatedPlan) {
          addErrorMessage(commandContext, `❌ **Plan Reset Failed**

Failed to reset plan status. This may be due to:
1. File system permissions
2. Corrupted plan data
3. Concurrent access to plan files

Please try again or check the orchestration logs.`);
          return;
        }

        // Reset all tasks to NOT_STARTED
        const tasks = await context.taskManifest.queryTasks({ orchestrationId });
        let resetTaskCount = 0;

        for (const task of tasks) {
          try {
            await context.taskManifest.updateTask(task.id, {
              status: TaskStatus.NOT_STARTED,
              progress: {
                completionPercentage: 0,
                lastUpdated: new Date(),
                milestones: [],
              },
              sessionId: undefined,
              metadata: {
                ...task.metadata,
                resetAt: new Date().toISOString(),
                previousStatus: task.status,
              },
            });
            resetTaskCount++;
          } catch (error) {
            console.warn(`Failed to reset task ${task.id}:`, error);
          }
        }

        // Suspend active sessions
        const sessions = await context.sessionRegistry.querySessions({
          orchestrationId,
          state: SessionState.ACTIVE,
        });

        let suspendedSessionCount = 0;
        for (const session of sessions) {
          try {
            await context.sessionRegistry.updateSession(session.id, {
              state: SessionState.SUSPENDED,
            });
            suspendedSessionCount++;
          } catch (error) {
            console.warn(`Failed to suspend session ${session.id}:`, error);
          }
        }

        addInfoMessage(commandContext, `✅ **Plan Reset Complete**

**Plan:** ${updatedPlan.name}
**New Status:** ${updatedPlan.status}
**Tasks Reset:** ${resetTaskCount} of ${tasks.length}
**Sessions Suspended:** ${suspendedSessionCount}
${parsedArgs.preserveRequirements ? `**Requirements Preserved:** ${updatedPlan.requirements.length}` : '**Requirements Cleared:** Ready for fresh analysis'}

**🚀 Ready for Fresh Planning**

**Next Steps:**
• Use \`/plan\` to create a new development plan
• Previous backup is available for recovery if needed
• Use \`/sessions\` to see suspended sessions

**Recovery Options:**
If you need to recover the previous state, backups are available in the orchestration directory.`);

        // Clear orchestration ID from session if it was the current one
        if (commandContext.session.stats.orchestrationId === orchestrationId) {
          commandContext.session.stats.orchestrationId = undefined;
        }

      } catch (error) {
        addErrorMessage(commandContext, `❌ **Plan Reset Error**

An unexpected error occurred during plan reset:
${error instanceof Error ? error.message : String(error)}

The plan state may be partially reset. Check \`/list_tasks\` and \`/sessions\` to verify current state.

Please try again or contact support if the issue persists.`);
      }
    },
  };
}
