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
 * Parse list tasks command arguments
 */
function parseListTasksArgs(args: string): {
  orchestrationId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  showDependencies?: boolean;
  showProgress?: boolean;
  format?: 'table' | 'list' | 'summary';
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

    if (arg === '--status' || arg === '-s') {
      result.status = argParts[++i] as TaskStatus;
    } else if (arg === '--priority' || arg === '-p') {
      result.priority = argParts[++i] as TaskPriority;
    } else if (arg === '--dependencies' || arg === '-d') {
      result.showDependencies = true;
    } else if (arg === '--progress') {
      result.showProgress = true;
    } else if (arg === '--format' || arg === '-f') {
      result.format = argParts[++i] as 'table' | 'list' | 'summary';
    } else if (arg === '--orchestration' || arg === '--orch') {
      result.orchestrationId = argParts[++i];
    } else if (!arg.startsWith('--') && !result.orchestrationId) {
      // First non-flag argument is orchestration ID
      result.orchestrationId = arg;
    }
  }

  // Set defaults
  result.format = result.format || 'table';

  return result;
}

/**
 * Format task list based on format type
 */
function formatTasks(tasks: any[], format: string, showDependencies: boolean, showProgress: boolean): string {
  if (tasks.length === 0) {
    return '📋 **No tasks found**\n\nUse `/plan` to create a development plan with tasks.';
  }

  switch (format) {
    case 'summary':
      return formatTaskSummary(tasks);
    case 'list':
      return formatTaskList(tasks, showDependencies, showProgress);
    case 'table':
    default:
      return formatTaskTable(tasks, showDependencies, showProgress);
  }
}

/**
 * Format tasks as summary
 */
function formatTaskSummary(tasks: any[]): string {
  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});

  const completed = statusCounts[TaskStatus.COMPLETED] || 0;
  const inProgress = statusCounts[TaskStatus.IN_PROGRESS] || 0;
  const notStarted = statusCounts[TaskStatus.NOT_STARTED] || 0;
  const blocked = statusCounts[TaskStatus.BLOCKED] || 0;
  const failed = statusCounts[TaskStatus.FAILED] || 0;

  const completionPercentage = Math.round((completed / tasks.length) * 100);

  return `📊 **Task Summary**

**Total Tasks:** ${tasks.length}
**Completion:** ${completionPercentage}% (${completed}/${tasks.length})

**Status Breakdown:**
✅ Completed: ${completed}
🔄 In Progress: ${inProgress}
⏳ Not Started: ${notStarted}
🚫 Blocked: ${blocked}
❌ Failed: ${failed}

**Progress Bar:**
${'█'.repeat(Math.floor(completionPercentage / 5))}${'░'.repeat(20 - Math.floor(completionPercentage / 5))} ${completionPercentage}%`;
}

/**
 * Format tasks as list
 */
function formatTaskList(tasks: any[], showDependencies: boolean, showProgress: boolean): string {
  const lines = ['📋 **Task List**', ''];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const statusIcon = getStatusIcon(task.status);
    const priorityIcon = getPriorityIcon(task.priority);

    lines.push(`${i + 1}. ${statusIcon} **${task.name}** ${priorityIcon}`);
    lines.push(`   ${task.description}`);

    if (showProgress) {
      lines.push(`   📊 Progress: ${task.progress.completionPercentage}%`);
    }

    if (showDependencies && task.dependencies.length > 0) {
      lines.push(`   🔗 Dependencies: ${task.dependencies.length}`);
    }

    if (task.estimation?.effortHours) {
      lines.push(`   ⏱️ Estimated: ${task.estimation.effortHours}h`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format tasks as table
 */
function formatTaskTable(tasks: any[], showDependencies: boolean, showProgress: boolean): string {
  const lines = ['📋 **Task Table**', ''];

  // Table header
  let header = '| # | Status | Name | Priority |';
  let separator = '|---|--------|------|----------|';

  if (showProgress) {
    header += ' Progress |';
    separator += '----------|';
  }

  if (showDependencies) {
    header += ' Deps |';
    separator += '------|';
  }

  lines.push(header);
  lines.push(separator);

  // Table rows
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const statusIcon = getStatusIcon(task.status);
    const priorityIcon = getPriorityIcon(task.priority);

    let row = `| ${i + 1} | ${statusIcon} ${task.status} | ${task.name} | ${priorityIcon} ${task.priority} |`;

    if (showProgress) {
      row += ` ${task.progress.completionPercentage}% |`;
    }

    if (showDependencies) {
      row += ` ${task.dependencies.length} |`;
    }

    lines.push(row);
  }

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
 * /list_tasks command - Display current task status
 */
export function listTasksCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'list_tasks',
    description: 'Display current task status and progress',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseListTasksArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**List Tasks Command Usage:**

\`/list_tasks [orchestration_id]\`

**Options:**
- \`--orchestration <id>\` - Specify orchestration ID
- \`--status <status>\` - Filter by task status (not_started, in_progress, completed, blocked, failed, cancelled)
- \`--priority <priority>\` - Filter by priority (low, medium, high, critical)
- \`--dependencies\` - Show dependency information
- \`--progress\` - Show progress details
- \`--format <format>\` - Output format (table, list, summary)
- \`--help\` - Show this help message

**Examples:**
\`/list_tasks\` - List all tasks in current orchestration
\`/list_tasks --status in_progress\` - Show only in-progress tasks
\`/list_tasks --format summary\` - Show task summary
\`/list_tasks --dependencies --progress\` - Show detailed task information

**Formats:**
- **table**: Structured table view (default)
- **list**: Detailed list with descriptions
- **summary**: High-level statistics and progress`);
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

Use \`/list_tasks --help\` for more information.`);
          return;
        }

        addInfoMessage(commandContext, `🔍 **Loading Tasks**

Orchestration ID: ${orchestrationId}
${parsedArgs.status ? `Status Filter: ${parsedArgs.status}` : ''}
${parsedArgs.priority ? `Priority Filter: ${parsedArgs.priority}` : ''}
Format: ${parsedArgs.format}

Retrieving task information...`);

        // Query tasks with filters
        const queryOptions: any = { orchestrationId };
        if (parsedArgs.status) queryOptions.status = parsedArgs.status;
        if (parsedArgs.priority) queryOptions.priority = parsedArgs.priority;

        const tasks = await context.taskManifest.queryTasks(queryOptions);

        if (tasks.length === 0) {
          if (parsedArgs.status || parsedArgs.priority) {
            addInfoMessage(commandContext, `📋 **No Matching Tasks**

No tasks found matching the specified filters:
${parsedArgs.status ? `• Status: ${parsedArgs.status}` : ''}
${parsedArgs.priority ? `• Priority: ${parsedArgs.priority}` : ''}

Try removing filters or use \`/list_tasks\` to see all tasks.`);
          } else {
            addInfoMessage(commandContext, `📋 **No Tasks Found**

Orchestration "${orchestrationId}" has no tasks.

Use \`/plan\` to create a development plan with tasks.`);
          }
          return;
        }

        // Format and display tasks
        const formattedTasks = formatTasks(
          tasks,
          parsedArgs.format!,
          parsedArgs.showDependencies || false,
          parsedArgs.showProgress || false
        );

        addInfoMessage(commandContext, formattedTasks);

        // Add additional information
        if (parsedArgs.format !== 'summary') {
          const stats = await context.taskManifest.getTaskStatistics(orchestrationId);
          addInfoMessage(commandContext, `📊 **Quick Stats:** ${stats.byStatus[TaskStatus.COMPLETED]}/${stats.total} completed (${stats.completionPercentage}%) • Average progress: ${stats.averageProgress}%`);
        }

        // Show next steps
        const nextTask = await context.taskManifest.getNextTask(orchestrationId);
        if (nextTask) {
          addInfoMessage(commandContext, `🎯 **Next Task:** ${nextTask.name}

Use \`/new_task\` to start implementing the next task.`);
        }

      } catch (error) {
        addErrorMessage(commandContext, `Failed to list tasks: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
