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
 * Parse session history command arguments
 */
function parseSessionHistoryArgs(args: string): {
  sessionId?: string;
  orchestrationId?: string;
  detailed?: boolean;
  timeline?: boolean;
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
      result.timeline = true;
    } else if (arg === '--orchestration' || arg === '--orch') {
      result.orchestrationId = argParts[++i];
    } else if (!arg.startsWith('--') && !result.sessionId) {
      // First non-flag argument is session ID
      result.sessionId = arg;
    }
  }

  return result;
}

/**
 * Format session history timeline
 */
function formatSessionTimeline(sessions: any[], detailed: boolean): string {
  if (sessions.length === 0) {
    return '📋 **No Session History**\n\nNo sessions found for the specified criteria.';
  }

  // Sort sessions by creation time
  const sortedSessions = sessions.sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const lines = ['📅 **Session Timeline**', ''];

  for (const session of sortedSessions) {
    const stateIcon = getSessionStateIcon(session.state);
    const typeIcon = getSessionTypeIcon(session.type);
    const duration = calculateSessionDuration(session);

    lines.push(`${stateIcon} **${session.id.substring(0, 8)}...** ${typeIcon} ${session.type}`);
    lines.push(`   📅 ${new Date(session.createdAt).toLocaleString()}`);
    lines.push(`   ⏱️ Duration: ${duration}`);

    if (session.context?.currentFocus) {
      lines.push(`   🎯 Focus: ${session.context.currentFocus}`);
    }

    if (detailed) {
      if (session.context?.decisions && session.context.decisions.length > 0) {
        lines.push(`   📋 Decisions: ${session.context.decisions.length}`);
      }

      if (session.context?.sequentialThinking && session.context.sequentialThinking.steps.length > 0) {
        lines.push(`   💭 Thinking Steps: ${session.context.sequentialThinking.steps.length}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Calculate session duration
 */
function calculateSessionDuration(session: any): string {
  const start = new Date(session.createdAt);
  const end = session.state === 'completed' ?
    new Date(session.completedAt || session.lastActivityAt) :
    new Date(session.lastActivityAt);

  const durationMs = end.getTime() - start.getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Get session state icon
 */
function getSessionStateIcon(state: string): string {
  switch (state) {
    case 'active': return '🟢';
    case 'suspended': return '🟡';
    case 'completed': return '✅';
    case 'failed': return '❌';
    default: return '⚪';
  }
}

/**
 * Get session type icon
 */
function getSessionTypeIcon(type: string): string {
  switch (type) {
    case 'planning': return '🎯';
    case 'task': return '⚙️';
    case 'verification': return '✔️';
    case 'interactive': return '💭';
    default: return '📋';
  }
}

/**
 * /session_history command - Show session progression and navigation
 */
export function sessionHistoryCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'session_history',
    description: 'Show session progression and navigation',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseSessionHistoryArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**Session History Command Usage:**

\`/session_history [session_id|orchestration_id]\`

**Options:**
- \`--orchestration <id>\` - Show history for specific orchestration
- \`--detailed\` - Show detailed session information
- \`--timeline\` - Show chronological timeline view
- \`--help\` - Show this help message

**Examples:**
\`/session_history\` - Show current orchestration history
\`/session_history session-123\` - Show specific session and its children
\`/session_history --timeline\` - Show chronological timeline
\`/session_history --orchestration orch-456 --detailed\` - Detailed orchestration history

**Views:**
- **Timeline**: Shows chronological progression of sessions
- **Detailed**: Includes decisions, thinking steps, and metadata

Use this command to understand how your orchestration sessions have evolved.`);
          return;
        }

        // Determine what to show history for
        let orchestrationId = parsedArgs.orchestrationId;

        if (!orchestrationId) {
          orchestrationId = commandContext.session.stats.orchestrationId;
        }

        if (!orchestrationId) {
          addErrorMessage(commandContext, `❌ **No Target Specified**

No orchestration ID provided and no active orchestration found.

**Options:**
1. Specify an orchestration ID: \`/session_history --orchestration <id>\`
2. Use \`/sessions\` to see available sessions
3. Use \`/plan\` to create a new orchestration

Use \`/session_history --help\` for more information.`);
          return;
        }

        addInfoMessage(commandContext, `🔍 **Loading Session History**

Orchestration ID: ${orchestrationId}
Retrieving session history...`);

        // Show all sessions for the orchestration
        const sessions = await context.sessionRegistry.querySessions({ orchestrationId });

        if (sessions.length === 0) {
          addInfoMessage(commandContext, `📋 **No Sessions Found**

No sessions found for orchestration "${orchestrationId}".

Use \`/sessions\` to see all available sessions.`);
          return;
        }

        // Show timeline view
        const timelineInfo = formatSessionTimeline(sessions, parsedArgs.detailed || false);
        addInfoMessage(commandContext, timelineInfo);

        // Add summary information
        const activeSessions = sessions.filter(s => s.state === 'active').length;
        const completedSessions = sessions.filter(s => s.state === 'completed').length;
        // Calculate approximate total duration
        const hours = sessions.length; // Placeholder calculation
        const minutes = 0;

        addInfoMessage(commandContext, `📊 **History Summary:**

**Total Sessions:** ${sessions.length}
**Active:** ${activeSessions} • **Completed:** ${completedSessions}
**Total Time:** ${hours}h ${minutes}m

Use \`/context <session_id>\` to see detailed session information.`);

      } catch (error) {
        addErrorMessage(commandContext, `Failed to show session history: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
