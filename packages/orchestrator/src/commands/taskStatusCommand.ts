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
import { TaskStatus, TaskPriority } from '../types/task.js';

/**
 * Parse task status command arguments
 */
function parseTaskStatusArgs(args: string): {
  orchestrationId?: string;
  taskId?: string;
  detailed?: boolean;
  showTimeline?: boolean;
  showDependencies?: boolean;
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

    if (arg === '--detailed' || arg === '-d') {
      result.detailed = true;
    } else if (arg === '--timeline' || arg === '-t') {
      result.showTimeline = true;
    } else if (arg === '--dependencies') {
      result.showDependencies = true;
    } else if (arg === '--orchestration' || arg === '--orch') {
      result.orchestrationId = argParts[++i];
    } else if (arg === '--task') {
      result.taskId = argParts[++i];
    } else if (!arg.startsWith('--') && !result.taskId && !result.orchestrationId) {
      // First non-flag argument could be task ID or orchestration ID
      if (arg.startsWith('task-') || arg.includes('-task-')) {
        result.taskId = arg;
      } else {
        result.orchestrationId = arg;
      }
    }
  }

  return result;
}

/**
 * Format orchestration status overview
 */
function formatOrchestrationStatus(stats: any, sessions: any[]): string {
  const completionIcon = stats.completionPercentage >= 100 ? '✅' :
                        stats.completionPercentage >= 80 ? '🟡' : '🔴';

  return `📊 **Orchestration Status Overview**

**Overall Progress:** ${stats.completionPercentage}% ${completionIcon}
**Tasks:** ${stats.byStatus[TaskStatus.COMPLETED]}/${stats.total} completed

**Task Breakdown:**
✅ Completed: ${stats.byStatus[TaskStatus.COMPLETED]}
🔄 In Progress: ${stats.byStatus[TaskStatus.IN_PROGRESS]}
⏳ Not Started: ${stats.byStatus[TaskStatus.NOT_STARTED]}
🚫 Blocked: ${stats.byStatus[TaskStatus.BLOCKED]}
❌ Failed: ${stats.byStatus[TaskStatus.FAILED]}

**Priority Distribution:**
🔴 Critical: ${stats.byPriority[TaskPriority.CRITICAL]}
🟠 High: ${stats.byPriority[TaskPriority.HIGH]}
🟡 Medium: ${stats.byPriority[TaskPriority.MEDIUM]}
🔵 Low: ${stats.byPriority[TaskPriority.LOW]}

**Effort Estimation:**
📊 Average Progress: ${stats.averageProgress}%
⏱️ Estimated Total: ${stats.estimatedTotalHours}h
${stats.actualTotalHours > 0 ? `🕐 Actual Total: ${stats.actualTotalHours}h` : ''}

**Sessions:** ${sessions.length} active`;
}

/**
 * Format detailed task information
 */
function formatTaskDetails(task: any): string {
  const statusIcon = getStatusIcon(task.status);
  const priorityIcon = getPriorityIcon(task.priority);

  const lines = [
    `📋 **Task Details: ${task.name}**`,
    '',
    `**Status:** ${statusIcon} ${task.status}`,
    `**Priority:** ${priorityIcon} ${task.priority}`,
    `**Progress:** ${task.progress.completionPercentage}%`,
    '',
    `**Description:**`,
    task.description,
    '',
  ];

  if (task.estimation) {
    lines.push(`**Estimation:**`);
    if (task.estimation.effortHours) {
      lines.push(`• Effort: ${task.estimation.effortHours} hours`);
    }
    if (task.estimation.durationHours) {
      lines.push(`• Duration: ${task.estimation.durationHours} hours`);
    }
    if (task.estimation.confidence) {
      lines.push(`• Confidence: ${Math.round(task.estimation.confidence * 100)}%`);
    }
    lines.push('');
  }

  if (task.acceptanceCriteria.length > 0) {
    lines.push(`**Acceptance Criteria:**`);
    for (const criteria of task.acceptanceCriteria) {
      const icon = criteria.isMet ? '✅' : '⏳';
      lines.push(`${icon} ${criteria.description}`);
    }
    lines.push('');
  }

  if (task.dependencies.length > 0) {
    lines.push(`**Dependencies:**`);
    for (const dep of task.dependencies) {
      lines.push(`• ${dep.taskId} (${dep.type})`);
    }
    lines.push('');
  }

  lines.push(`**Timeline:**`);
  lines.push(`• Created: ${new Date(task.createdAt).toLocaleString()}`);
  if (task.startedAt) {
    lines.push(`• Started: ${new Date(task.startedAt).toLocaleString()}`);
  }
  if (task.completedAt) {
    lines.push(`• Completed: ${new Date(task.completedAt).toLocaleString()}`);
  }
  lines.push(`• Last Updated: ${new Date(task.updatedAt).toLocaleString()}`);

  return lines.join('\n');
}

/**
 * Get status icon
 */
function getStatusIcon(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.COMPLETED: return '✅';
    case TaskStatus.IN_PROGRESS: return '🔄';
    case TaskStatus.BLOCKED: return '🚫';
    case TaskStatus.FAILED: return '❌';
    case TaskStatus.CANCELLED: return '⏹️';
    case TaskStatus.NOT_STARTED:
    default: return '⏳';
  }
}

/**
 * Get priority icon
 */
function getPriorityIcon(priority: TaskPriority): string {
  switch (priority) {
    case TaskPriority.CRITICAL: return '🔴';
    case TaskPriority.HIGH: return '🟠';
    case TaskPriority.MEDIUM: return '🟡';
    case TaskPriority.LOW: return '🔵';
    default: return '⚪';
  }
}

/**
 * /task_status command - Show detailed progress information
 */
export function taskStatusCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'task_status',
    description: 'Show detailed progress information and metrics',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseTaskStatusArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**Task Status Command Usage:**

\`/task_status [orchestration_id|task_id]\`

**Options:**
- \`--orchestration <id>\` - Show status for specific orchestration
- \`--task <id>\` - Show detailed status for specific task
- \`--detailed\` - Show detailed information including timelines
- \`--timeline\` - Show task timeline and milestones
- \`--dependencies\` - Show dependency information
- \`--help\` - Show this help message

**Examples:**
\`/task_status\` - Show current orchestration status
\`/task_status task-123\` - Show specific task details
\`/task_status --detailed\` - Show detailed orchestration status
\`/task_status --task task-456 --timeline\` - Show task with timeline

**Information Displayed:**
- Overall progress and completion metrics
- Task breakdown by status and priority
- Time estimates and actual hours
- Blocked or failed tasks
- Next action recommendations`);
          return;
        }

        // Get orchestration ID
        let orchestrationId = parsedArgs.orchestrationId ||
                             commandContext.session.stats.orchestrationId;

        if (!orchestrationId && !parsedArgs.taskId) {
          addErrorMessage(commandContext, `❌ **No Active Orchestration**

No orchestration ID found. Please:
1. Run \`/plan\` to create a new plan, or
2. Use \`/sessions\` to find existing orchestrations, or
3. Specify orchestration ID with \`--orchestration <id>\`

Use \`/task_status --help\` for more information.`);
          return;
        }

        // Show specific task status
        if (parsedArgs.taskId) {
          addInfoMessage(commandContext, `🔍 **Loading Task Status**

Task ID: ${parsedArgs.taskId}
Loading detailed task information...`);

          const task = await context.taskManifest.loadTask(parsedArgs.taskId);

          if (!task) {
            addErrorMessage(commandContext, `❌ **Task Not Found**

Task ID "${parsedArgs.taskId}" does not exist.

Use \`/list_tasks\` to see available tasks.`);
            return;
          }

          const taskDetails = formatTaskDetails(task);
          addInfoMessage(commandContext, taskDetails);

          // Show session information if available
          if (task.sessionId) {
            const session = await context.stateManager.loadSession(task.sessionId);
            if (session) {
              addInfoMessage(commandContext, `🔗 **Associated Session**

**Session ID:** ${session.id}
**Type:** ${session.type}
**State:** ${session.state}
**Focus:** ${session.context.currentFocus}
**Last Activity:** ${new Date(session.lastActivityAt).toLocaleString()}`);
            }
          }

          return;
        }

        // Show orchestration status
        addInfoMessage(commandContext, `📊 **Loading Orchestration Status**

Orchestration ID: ${orchestrationId}
Analyzing progress and metrics...`);

        // Get orchestration statistics
        const stats = await context.taskManifest.getTaskStatistics(orchestrationId);

        // Get active sessions
        const sessions = await context.stateManager.querySessions({ orchestrationId });

        // Format and display status
        const statusOverview = formatOrchestrationStatus(stats, sessions);
        addInfoMessage(commandContext, statusOverview);

        // Show detailed information if requested
        if (parsedArgs.detailed) {
          // Get tasks with issues
          const allTasks = await context.taskManifest.queryTasks({ orchestrationId });
          const blockedTasks = allTasks.filter(t => t.status === TaskStatus.BLOCKED);
          const failedTasks = allTasks.filter(t => t.status === TaskStatus.FAILED);
          const inProgressTasks = allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS);

          if (blockedTasks.length > 0 || failedTasks.length > 0) {
            const issueLines = ['⚠️ **Issues Requiring Attention**', ''];

            if (blockedTasks.length > 0) {
              issueLines.push(`🚫 **Blocked Tasks (${blockedTasks.length}):**`);
              blockedTasks.forEach(task => {
                issueLines.push(`• ${task.name}`);
              });
              issueLines.push('');
            }

            if (failedTasks.length > 0) {
              issueLines.push(`❌ **Failed Tasks (${failedTasks.length}):**`);
              failedTasks.forEach(task => {
                issueLines.push(`• ${task.name}`);
              });
              issueLines.push('');
            }

            addInfoMessage(commandContext, issueLines.join('\n'));
          }

          if (inProgressTasks.length > 0) {
            addInfoMessage(commandContext, `🔄 **Currently In Progress (${inProgressTasks.length}):**

${inProgressTasks.map(task => `• ${task.name} (${task.progress.completionPercentage}%)`).join('\n')}`);
          }
        }

        // Show next steps
        const nextTask = await context.taskManifest.getNextTask(orchestrationId);
        if (nextTask) {
          addInfoMessage(commandContext, `🎯 **Next Recommended Action**

**Next Task:** ${nextTask.name}
**Priority:** ${getPriorityIcon(nextTask.priority)} ${nextTask.priority}
**Estimated Effort:** ${nextTask.estimation?.effortHours || 'Not specified'} hours

Use \`/new_task\` to start implementing this task.`);
        } else if (stats.completionPercentage >= 100) {
          addInfoMessage(commandContext, `🎉 **Project Complete!**

All tasks have been completed. Use \`/check_completeness\` to perform final verification.`);
        } else {
          addInfoMessage(commandContext, `⏸️ **No Available Tasks**

All remaining tasks may be blocked or in progress. Use \`/list_tasks --status blocked\` to see blocked tasks.`);
        }

      } catch (error) {
        addErrorMessage(commandContext, `Failed to get task status: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
