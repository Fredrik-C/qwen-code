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
import { SessionState } from '../types/session.js';

/**
 * Parse resume command arguments
 */
function parseResumeArgs(args: string): {
  sessionId?: string;
  force?: boolean;
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
    } else if (!arg.startsWith('--') && !result.sessionId) {
      // First non-flag argument is session ID
      result.sessionId = arg;
    }
  }

  return result;
}

/**
 * Format session resumption information
 */
function formatSessionResumption(session: any): string {
  const lines = [
    `🔄 **Resuming Session: ${session.id}**`,
    '',
    `**Type:** ${session.type}`,
    `**State:** ${session.state}`,
    `**Focus:** ${session.context?.currentFocus || 'Not specified'}`,
    `**Last Activity:** ${new Date(session.lastActivityAt).toLocaleString()}`,
    '',
  ];

  if (session.context?.currentTask) {
    lines.push(`**Current Task:** ${session.context.currentTask}`);
  }

  if (session.context?.nextSteps && session.context.nextSteps.length > 0) {
    lines.push(`**Next Steps:**`);
    session.context.nextSteps.forEach((step: string, index: number) => {
      lines.push(`${index + 1}. ${step}`);
    });
    lines.push('');
  }

  if (session.parentSessionId) {
    lines.push(`**Parent Session:** ${session.parentSessionId}`);
  }

  if (session.childSessionIds && session.childSessionIds.length > 0) {
    lines.push(`**Child Sessions:** ${session.childSessionIds.length} active`);
  }

  return lines.join('\n');
}

/**
 * /resume command - Resume a paused orchestration session
 */
export function resumeCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'resume',
    description: 'Resume a paused orchestration session',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseResumeArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**Resume Command Usage:**

\`/resume <session_id>\`

**Options:**
- \`--force\` - Force resume even if session is not in suspended state
- \`--help\` - Show this help message

**Examples:**
\`/resume session-123\` - Resume specific session
\`/resume session-456 --force\` - Force resume session

**Session States:**
- **Active**: Already running (cannot resume)
- **Suspended**: Can be resumed
- **Completed**: Cannot be resumed (use --force to restart)
- **Failed**: Can be resumed to retry

Use \`/sessions\` to see available sessions and their states.`);
          return;
        }

        if (!parsedArgs.sessionId) {
          addErrorMessage(commandContext, `❌ **Session ID Required**

Please specify a session ID to resume:
\`/resume <session_id>\`

Use \`/sessions\` to see available sessions.`);
          return;
        }

        addInfoMessage(commandContext, `🔍 **Loading Session**

Session ID: ${parsedArgs.sessionId}
Checking session state and preparing to resume...`);

        // Load the session
        const session = await context.sessionRegistry.getSession(parsedArgs.sessionId);

        if (!session) {
          addErrorMessage(commandContext, `❌ **Session Not Found**

Session "${parsedArgs.sessionId}" does not exist.

Use \`/sessions\` to see available sessions.`);
          return;
        }

        // Check if session can be resumed
        if (session.state === SessionState.ACTIVE && !parsedArgs.force) {
          addErrorMessage(commandContext, `⚠️ **Session Already Active**

Session "${parsedArgs.sessionId}" is already active.

Use \`/sessions\` to see session details or \`--force\` to restart.`);
          return;
        }

        if (session.state === SessionState.COMPLETED && !parsedArgs.force) {
          addErrorMessage(commandContext, `✅ **Session Already Completed**

Session "${parsedArgs.sessionId}" has already completed successfully.

Use \`--force\` to restart the session if needed.`);
          return;
        }

        // Resume the session
        addInfoMessage(commandContext, `🔄 **Resuming Session**

Restoring session state and context...`);

        // Update session state to active
        session.state = SessionState.ACTIVE;
        session.lastActivityAt = new Date();

        // Save the updated session
        await context.sessionRegistry.updateSession(session.id, {
          state: SessionState.ACTIVE,
        });

        // Display session information
        const sessionInfo = formatSessionResumption(session);
        addInfoMessage(commandContext, sessionInfo);

        // Update command context session
        commandContext.session.stats.orchestrationId = session.orchestrationId;

        addInfoMessage(commandContext, `✅ **Session Resumed Successfully**

Session "${session.id}" is now active and ready for work.

**Next Actions:**
- Use \`/task_status\` to see current progress
- Use \`/new_task\` to continue with the next task
- Use \`/context\` to see session context

The session has been set as your current active session.`);

      } catch (error) {
        addErrorMessage(commandContext, `Failed to resume session: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
