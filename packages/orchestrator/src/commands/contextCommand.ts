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

/**
 * Parse context command arguments
 */
function parseContextArgs(args: string): {
  sessionId?: string;
  detailed?: boolean;
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
    } else if (!arg.startsWith('--') && !result.sessionId) {
      // First non-flag argument is session ID
      result.sessionId = arg;
    }
  }

  return result;
}

/**
 * Format session context information
 */
function formatSessionContext(session: any, detailed: boolean): string {
  const lines = [
    `📋 **Session Context: ${session.id}**`,
    '',
    `**Type:** ${session.type}`,
    `**State:** ${session.state}`,
    `**Orchestration ID:** ${session.orchestrationId}`,
    `**Created:** ${new Date(session.createdAt).toLocaleString()}`,
    `**Last Activity:** ${new Date(session.lastActivityAt).toLocaleString()}`,
    '',
  ];

  // Current focus and task
  if (session.context?.currentFocus) {
    lines.push(`**Current Focus:** ${session.context.currentFocus}`);
  }

  if (session.context?.currentTask) {
    lines.push(`**Current Task:** ${session.context.currentTask}`);
  }

  if (session.context?.currentPhase) {
    lines.push(`**Current Phase:** ${session.context.currentPhase}`);
  }

  lines.push('');

  // Session hierarchy
  if (session.parentSessionId) {
    lines.push(`**Parent Session:** ${session.parentSessionId}`);
  }

  if (session.childSessionIds && session.childSessionIds.length > 0) {
    lines.push(`**Child Sessions:** ${session.childSessionIds.length} sessions`);
    if (detailed) {
      session.childSessionIds.forEach((childId: string) => {
        lines.push(`  • ${childId}`);
      });
    }
  }

  lines.push('');

  // Context details
  if (session.context) {
    if (session.context.nextSteps && session.context.nextSteps.length > 0) {
      lines.push(`**Next Steps:**`);
      session.context.nextSteps.forEach((step: string, index: number) => {
        lines.push(`${index + 1}. ${step}`);
      });
      lines.push('');
    }

    if (session.context.decisions && session.context.decisions.length > 0) {
      lines.push(`**Recent Decisions:** ${session.context.decisions.length}`);
      if (detailed) {
        session.context.decisions.slice(-3).forEach((decision: any) => {
          lines.push(`  • ${decision.title} (${new Date(decision.timestamp).toLocaleString()})`);
        });
      }
      lines.push('');
    }

    if (session.context.sequentialThinking && session.context.sequentialThinking.steps.length > 0) {
      lines.push(`**Thinking Steps:** ${session.context.sequentialThinking.steps.length}`);
      if (detailed) {
        const recentSteps = session.context.sequentialThinking.steps.slice(-3);
        recentSteps.forEach((step: any) => {
          lines.push(`  ${step.stepNumber}. ${step.thought.substring(0, 100)}...`);
        });
      }
      lines.push('');
    }
  }

  // Metadata
  if (session.metadata) {
    if (session.metadata.name) {
      lines.push(`**Name:** ${session.metadata.name}`);
    }
    if (session.metadata.description) {
      lines.push(`**Description:** ${session.metadata.description}`);
    }
    if (session.metadata.tags && session.metadata.tags.length > 0) {
      lines.push(`**Tags:** ${session.metadata.tags.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * /context command - Show current session context and state
 */
export function contextCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'context',
    description: 'Show current session context and state',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseContextArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**Context Command Usage:**

\`/context [session_id]\`

**Options:**
- \`--detailed\` - Show detailed context information
- \`--help\` - Show this help message

**Examples:**
\`/context\` - Show current session context
\`/context session-123\` - Show specific session context
\`/context --detailed\` - Show detailed current session context

**Context Information:**
- Session metadata and state
- Current focus and task
- Session hierarchy (parent/child relationships)
- Recent decisions and thinking steps
- Next planned actions

Use this command to understand the current state of your orchestration session.`);
          return;
        }

        // Determine which session to show context for
        let sessionId = parsedArgs.sessionId;
        if (!sessionId) {
          sessionId = commandContext.session.stats.orchestrationId;
        }

        if (!sessionId) {
          addErrorMessage(commandContext, `❌ **No Active Session**

No session ID provided and no active orchestration session found.

**Options:**
1. Specify a session ID: \`/context <session_id>\`
2. Use \`/sessions\` to see available sessions
3. Use \`/plan\` to create a new session

Use \`/context --help\` for more information.`);
          return;
        }

        addInfoMessage(commandContext, `🔍 **Loading Session Context**

Session ID: ${sessionId}
Retrieving context information...`);

        // Load the session
        const session = await context.sessionRegistry.getSession(sessionId);

        if (!session) {
          addErrorMessage(commandContext, `❌ **Session Not Found**

Session "${sessionId}" does not exist.

Use \`/sessions\` to see available sessions.`);
          return;
        }

        // Format and display context
        const contextInfo = formatSessionContext(session, parsedArgs.detailed || false);
        addInfoMessage(commandContext, contextInfo);

        // Add helpful next steps
        addInfoMessage(commandContext, `💡 **Quick Actions:**

- \`/task_status\` - See current task progress
- \`/list_tasks\` - View all tasks in this orchestration
- \`/new_task\` - Start working on the next task
- \`/sessions\` - See all sessions

Use \`/context --detailed\` for more comprehensive information.`);

      } catch (error) {
        addErrorMessage(commandContext, `Failed to show context: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
