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
import { PlanningService } from '../planning/PlanningService.js';
import { ThinkingToolIntegration } from '../planning/ThinkingToolIntegration.js';
import { CreatePlanParams } from '../types/planning.js';
import { TaskPriority } from '../types/task.js';

/**
 * Parse plan command arguments
 */
function parsePlanArgs(args: string): {
  name?: string;
  description?: string;
  requirements?: string[];
  help?: boolean;
} {
  const result: any = {};

  if (!args || args.trim() === '' || args.includes('--help') || args.includes('-h')) {
    result.help = true;
    return result;
  }

  // Simple argument parsing
  const lines = args.split('\n').map(line => line.trim()).filter(line => line);

  if (lines.length > 0) {
    result.name = lines[0];
  }

  if (lines.length > 1) {
    result.description = lines.slice(1).join(' ');
  }

  // Extract requirements if specified
  const requirementMatch = args.match(/--requirements?\s+(.+)/i);
  if (requirementMatch) {
    result.requirements = requirementMatch[1].split(',').map(r => r.trim());
  }

  return result;
}

/**
 * /plan command - Initiate structured planning phase
 */
export function planCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'plan',
    description: 'Initiate structured planning phase with sequential thinking',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parsePlanArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**Plan Command Usage:**

\`/plan <project_name>\`
\`<project_description>\`

**Options:**
- \`--requirements <req1,req2,req3>\` - Specify initial requirements
- \`--help\` - Show this help message

**Examples:**
\`/plan User Authentication System\`
\`Implement secure user login and registration with JWT tokens\`

\`/plan E-commerce API --requirements "user management,product catalog,order processing"\`
\`RESTful API for online store with payment integration\`

**Process:**
1. Creates fresh planning session for objectivity
2. Enforces mandatory sequential thinking analysis
3. Generates comprehensive development plan
4. Creates task breakdown and manifest
5. Stores plan for implementation tracking

**Next Steps:**
After planning, use \`/approve_plan\` to begin implementation or \`/reset_plan\` to start over.`);
          return;
        }

        if (!parsedArgs.name) {
          addErrorMessage(commandContext, 'Project name is required. Use `/plan --help` for usage information.');
          return;
        }

        addInfoMessage(commandContext, `🚀 **Starting Planning Phase**

**Project:** ${parsedArgs.name}
${parsedArgs.description ? `**Description:** ${parsedArgs.description}` : ''}

Initializing structured planning workflow with mandatory sequential thinking...`);

        // Generate unique orchestration ID
        const orchestrationId = `orch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create planning service
        const thinkingIntegration = new ThinkingToolIntegration(
          context.config,
          {} as any, // Tool registry not available in this context
          context.sessionRegistry
        );

        const planningService = new PlanningService(
          context.sessionRegistry,
          context.taskManifest,
          thinkingIntegration
        );

        // Prepare plan parameters
        const planParams: CreatePlanParams = {
          name: parsedArgs.name,
          description: parsedArgs.description || `Development plan for ${parsedArgs.name}`,
          requirements: parsedArgs.requirements?.map(req => ({
            title: req,
            description: `Requirement: ${req}`,
            type: 'functional' as const,
            priority: TaskPriority.MEDIUM,
            status: 'identified' as const,
          })),
          metadata: {
            orchestrationId,
            createdViaCommand: true,
            userInput: args,
          },
        };

        addInfoMessage(commandContext, `🧠 **Mandatory Thinking Phase**

Sequential thinking is required for all planning operations. This ensures thorough analysis and high-quality plans.

Please use the sequential thinking tool to analyze:
1. Requirements and constraints
2. Architecture and design approaches
3. Task breakdown and dependencies
4. Risk assessment and mitigation
5. Implementation strategy

The planning workflow will continue once thinking is complete.`);

        // Execute planning workflow
        const result = await planningService.executePlanningWorkflow(
          orchestrationId,
          planParams,
          args
        );

        if (result.success && result.plan) {
          addInfoMessage(commandContext, `✅ **Planning Complete**

**Plan Created:** ${result.plan.name}
**Plan ID:** ${result.plan.id}
**Status:** ${result.plan.status}
**Requirements:** ${result.plan.requirements.length}
**Phases:** ${result.plan.phases.length}
**Tasks:** ${result.plan.tasks.length}

${result.warnings.length > 0 ? `**Warnings:**\n${result.warnings.map(w => `⚠️ ${w}`).join('\n')}\n` : ''}

**Next Steps:**
${result.nextSteps.map(step => `• ${step}`).join('\n')}

Use \`/list_tasks\` to view the task breakdown or \`/approve_plan\` to begin implementation.`);

          // Store orchestration ID for future commands
          commandContext.session.stats.orchestrationId = orchestrationId;

        } else {
          addErrorMessage(commandContext, `❌ **Planning Failed**

${result.errors.map(error => `• ${error}`).join('\n')}

${result.warnings.length > 0 ? `\n**Warnings:**\n${result.warnings.map(w => `⚠️ ${w}`).join('\n')}` : ''}

Please address the issues above and try again.`);
        }

      } catch (error) {
        addErrorMessage(commandContext, `Planning failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
