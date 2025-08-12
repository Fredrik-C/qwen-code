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
import { SessionState, SessionType } from '../types/session.js';

/**
 * Parse sessions command arguments
 */
function parseSessionsArgs(args: string): {
  orchestrationId?: string;
  state?: SessionState;
  type?: SessionType;
  showDetails?: boolean;
  cleanup?: boolean;
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

    if (arg === '--state' || arg === '-s') {
      result.state = argParts[++i] as SessionState;
    } else if (arg === '--type' || arg === '-t') {
      result.type = argParts[++i] as SessionType;
    } else if (arg === '--details' || arg === '-d') {
      result.showDetails = true;
    } else if (arg === '--cleanup') {
      result.cleanup = true;
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
 * Format session list for display
 */
function formatSessionList(sessions: any[], showDetails: boolean): string {
  if (sessions.length === 0) {
    return '📋 **No Sessions Found**\n\nNo orchestration sessions exist. Use `/plan` to create a new planning session.';
  }

  const lines = ['📋 **Orchestration Sessions**', ''];

  if (showDetails) {
    for (const session of sessions) {
      const stateIcon = getSessionStateIcon(session.state);
      const typeIcon = getSessionTypeIcon(session.type);

      lines.push(`${stateIcon} **${session.id}** ${typeIcon}`);
      lines.push(`   **Type:** ${session.type}`);
      lines.push(`   **State:** ${session.state}`);
      lines.push(`   **Focus:** ${session.context?.currentFocus || 'Not specified'}`);
      lines.push(`   **Created:** ${new Date(session.createdAt).toLocaleString()}`);
      lines.push(`   **Last Activity:** ${new Date(session.lastActivityAt).toLocaleString()}`);

      if (session.parentSessionId) {
        lines.push(`   **Parent:** ${session.parentSessionId}`);
      }

      if (session.childSessionIds && session.childSessionIds.length > 0) {
        lines.push(`   **Children:** ${session.childSessionIds.length} sessions`);
      }

      lines.push('');
    }
  } else {
    // Table format
    lines.push('| ID | Type | State | Focus | Last Activity |');
    lines.push('|----|------|-------|-------|---------------|');

    for (const session of sessions) {
      const stateIcon = getSessionStateIcon(session.state);
      const typeIcon = getSessionTypeIcon(session.type);
      const shortId = session.id.substring(0, 8) + '...';
      const focus = (session.context?.currentFocus || 'Not specified').substring(0, 30);
      const lastActivity = new Date(session.lastActivityAt).toLocaleDateString();

      lines.push(`| ${shortId} | ${typeIcon} ${session.type} | ${stateIcon} ${session.state} | ${focus} | ${lastActivity} |`);
    }
  }

  return lines.join('\n');
}

/**
 * Get session state icon
 */
function getSessionStateIcon(state: SessionState): string {
  switch (state) {
    case SessionState.ACTIVE: return '🟢';
    case SessionState.SUSPENDED: return '🟡';
    case SessionState.COMPLETED: return '✅';
    case SessionState.FAILED: return '❌';
    default: return '⚪';
  }
}

/**
 * Get session type icon
 */
function getSessionTypeIcon(type: SessionType): string {
  switch (type) {
    case SessionType.PLANNING: return '🎯';
    case SessionType.TASK: return '⚙️';
    case SessionType.VERIFICATION: return '✔️';
    case SessionType.INTERACTIVE: return '💭';
    default: return '📋';
  }
}

/**
 * /sessions command - List and manage orchestration sessions
 */
export function sessionsCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'sessions',
    description: 'List and manage orchestration sessions',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseSessionsArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**Sessions Command Usage:**

\`/sessions [orchestration_id]\`

**Options:**
- \`--orchestration <id>\` - Filter by orchestration ID
- \`--state <state>\` - Filter by session state (active, paused, completed, failed, cancelled)
- \`--type <type>\` - Filter by session type (planning, task_execution, verification, thinking)
- \`--details\` - Show detailed session information
- \`--cleanup\` - Remove completed and failed sessions
- \`--help\` - Show this help message

**Examples:**
\`/sessions\` - List all sessions
\`/sessions --state active\` - Show only active sessions
\`/sessions --type planning --details\` - Show detailed planning sessions
\`/sessions --cleanup\` - Clean up old sessions

**Session States:**
- **Active**: Currently running or ready to resume
- **Paused**: Temporarily suspended
- **Completed**: Successfully finished
- **Failed**: Ended with errors
- **Cancelled**: Manually terminated`);
          return;
        }

        // Handle cleanup operation
        if (parsedArgs.cleanup) {
          addInfoMessage(commandContext, '🧹 **Cleaning Up Sessions**\n\nRemoving completed and failed sessions...');

          const cleanupResult = await context.sessionRegistry.cleanupSessions();

          addInfoMessage(commandContext, `✅ **Cleanup Complete**

**Removed Sessions:** ${cleanupResult.removedCount}
**Remaining Sessions:** ${cleanupResult.remainingCount}
**Space Freed:** ${cleanupResult.spaceFree || 'Unknown'}

Use \`/sessions\` to see remaining sessions.`);
          return;
        }

        addInfoMessage(commandContext, '🔍 **Loading Sessions**\n\nRetrieving session information...');

        // Query sessions with filters
        const queryOptions: any = {};
        if (parsedArgs.orchestrationId) queryOptions.orchestrationId = parsedArgs.orchestrationId;
        if (parsedArgs.state) queryOptions.state = parsedArgs.state;
        if (parsedArgs.type) queryOptions.type = parsedArgs.type;

        const sessions = await context.sessionRegistry.querySessions(queryOptions);

        if (sessions.length === 0) {
          if (parsedArgs.state || parsedArgs.type || parsedArgs.orchestrationId) {
            addInfoMessage(commandContext, `📋 **No Matching Sessions**

No sessions found matching the specified filters:
${parsedArgs.orchestrationId ? `• Orchestration: ${parsedArgs.orchestrationId}` : ''}
${parsedArgs.state ? `• State: ${parsedArgs.state}` : ''}
${parsedArgs.type ? `• Type: ${parsedArgs.type}` : ''}

Try removing filters or use \`/sessions\` to see all sessions.`);
          } else {
            addInfoMessage(commandContext, `📋 **No Sessions Found**

No orchestration sessions exist yet.

Use \`/plan\` to create a new planning session and start orchestrating your development work.`);
          }
          return;
        }

        // Format and display sessions
        const formattedSessions = formatSessionList(sessions, parsedArgs.showDetails || false);
        addInfoMessage(commandContext, formattedSessions);

        // Add summary information
        const activeSessions = sessions.filter(s => s.state === SessionState.ACTIVE).length;
        const completedSessions = sessions.filter(s => s.state === SessionState.COMPLETED).length;

        addInfoMessage(commandContext, `📊 **Session Summary:** ${sessions.length} total • ${activeSessions} active • ${completedSessions} completed

Use \`/resume <session_id>\` to resume a session or \`/sessions --cleanup\` to remove old sessions.`);

      } catch (error) {
        addErrorMessage(commandContext, `Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
