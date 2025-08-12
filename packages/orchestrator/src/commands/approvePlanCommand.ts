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

/**
 * Parse approve plan command arguments
 */
function parseApprovePlanArgs(args: string): {
  orchestrationId?: string;
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
 * /approve_plan command - Manual plan approval workflow
 */
export function approvePlanCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'approve_plan',
    description: 'Approve development plan and initialize task execution',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseApprovePlanArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**Approve Plan Command Usage:**

\`/approve_plan [orchestration_id]\`

**Options:**
- \`--orchestration <id>\` - Specify orchestration ID to approve
- \`--force\` - Force approval even if plan has issues
- \`--help\` - Show this help message

**Examples:**
\`/approve_plan\` - Approve current orchestration plan
\`/approve_plan orch-123\` - Approve specific orchestration plan
\`/approve_plan --force\` - Force approve current plan

**Process:**
1. Validates plan exists and is in DRAFT status
2. Reviews plan completeness and quality
3. Updates plan status to APPROVED
4. Initializes task execution readiness
5. Provides next steps for implementation

**Prerequisites:**
- Active orchestration with plan in DRAFT status
- Plan must have requirements and tasks defined
- No critical validation errors (unless --force used)`);
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

Use \`/approve_plan --help\` for more information.`);
          return;
        }

        addInfoMessage(commandContext, `🔍 **Reviewing Plan for Approval**

Orchestration ID: ${orchestrationId}

Loading plan and validating readiness for approval...`);

        // Load the current plan
        const plan = await context.taskManifest.loadPlan(orchestrationId);
        if (!plan) {
          addErrorMessage(commandContext, `❌ **Plan Not Found**

No plan found for orchestration "${orchestrationId}".

Please ensure:
1. The orchestration ID is correct
2. A plan has been created using \`/plan\`
3. The plan files are accessible

Use \`/list_tasks\` to see available orchestrations.`);
          return;
        }

        // Validate plan status
        if (plan.status === PlanStatus.APPROVED) {
          addInfoMessage(commandContext, `✅ **Plan Already Approved**

Plan "${plan.name}" is already approved and ready for execution.

**Current Status:** ${plan.status}
**Requirements:** ${plan.requirements.length}
**Tasks:** ${plan.tasks.length}

Use \`/new_task\` to start implementing tasks or \`/list_tasks\` to see the task breakdown.`);
          return;
        }

        if (plan.status !== PlanStatus.DRAFT && !parsedArgs.force) {
          addErrorMessage(commandContext, `❌ **Plan Not Ready for Approval**

Plan status is "${plan.status}" but must be "draft" for approval.

Current plan status: ${plan.status}

Use \`--force\` to approve anyway, or create a new plan with \`/reset_plan\` first.`);
          return;
        }

        // Validate plan completeness
        const validationIssues: string[] = [];

        if (plan.requirements.length === 0) {
          validationIssues.push('No requirements defined');
        }

        if (plan.tasks.length === 0) {
          validationIssues.push('No tasks defined');
        }

        if (plan.phases.length === 0) {
          validationIssues.push('No development phases defined');
        }

        if (validationIssues.length > 0 && !parsedArgs.force) {
          addErrorMessage(commandContext, `❌ **Plan Validation Failed**

The following issues must be resolved before approval:

${validationIssues.map(issue => `• ${issue}`).join('\n')}

**Options:**
1. Use \`/reset_plan\` to recreate the plan with proper requirements
2. Use \`--force\` to approve despite these issues

Use \`/approve_plan --help\` for more information.`);
          return;
        }

        // Approve the plan
        const updatedPlan = await context.taskManifest.updatePlan(orchestrationId, {
          status: PlanStatus.APPROVED,
          currentPhase: PlanningPhase.COMPLETED,
          metadata: {
            ...plan.metadata,
            approvedAt: new Date().toISOString(),
            approvedViaCommand: true,
            forcedApproval: parsedArgs.force || false,
          },
        });

        if (!updatedPlan) {
          addErrorMessage(commandContext, `❌ **Plan Approval Failed**

Failed to update plan status. This may be due to:
1. File system permissions
2. Corrupted plan data
3. Concurrent access to plan files

Please try again or check the orchestration logs.`);
          return;
        }

        addInfoMessage(commandContext, `✅ **Plan Approved Successfully**

**Plan:** ${updatedPlan.name}
**Status:** ${updatedPlan.status}
**Requirements:** ${updatedPlan.requirements.length}
**Tasks:** ${updatedPlan.tasks.length}
**Phases:** ${updatedPlan.phases.length}

${validationIssues.length > 0 ? `**⚠️ Approved with warnings:**\n${validationIssues.map(issue => `• ${issue}`).join('\n')}\n` : ''}

**🚀 Ready for Implementation**

**Next Steps:**
• Use \`/new_task\` to start implementing the first task
• Use \`/list_tasks\` to view the complete task breakdown
• Use \`/task_status\` to monitor implementation progress
• Use \`/check_completeness\` to verify project completion

The plan is now locked for execution. Use \`/reset_plan\` if you need to make changes.`);

        // Store orchestration ID for future commands
        commandContext.session.stats.orchestrationId = orchestrationId;

      } catch (error) {
        addErrorMessage(commandContext, `❌ **Plan Approval Error**

An unexpected error occurred during plan approval:
${error instanceof Error ? error.message : String(error)}

Please try again or contact support if the issue persists.`);
      }
    },
  };
}
