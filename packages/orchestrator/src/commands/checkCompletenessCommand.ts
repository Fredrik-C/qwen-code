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
import { VerificationService } from '../verification/VerificationService.js';
import { ContextLoader } from '../session/ContextLoader.js';
import { TaskStatus } from '../types/task.js';
import { SessionType, CreateSessionParams } from '../types/session.js';

/**
 * Parse check completeness command arguments
 */
function parseCompletenessArgs(args: string): {
  orchestrationId?: string;
  detailed?: boolean;
  skipTests?: boolean;
  generateReport?: boolean;
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
    } else if (arg === '--skip-tests') {
      result.skipTests = true;
    } else if (arg === '--report' || arg === '-r') {
      result.generateReport = true;
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
 * /check_completeness command - Verify overall project completion
 */
export function checkCompletenessCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'check_completeness',
    description: 'Verify overall project completion and provide recommendations',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseCompletenessArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**Check Completeness Command Usage:**

\`/check_completeness [orchestration_id]\`

**Options:**
- \`--orchestration <id>\` - Specify orchestration ID to check
- \`--detailed\` - Show detailed analysis of each task and requirement
- \`--skip-tests\` - Skip automated test execution
- \`--report\` - Generate comprehensive completion report
- \`--help\` - Show this help message

**Examples:**
\`/check_completeness\` - Check current orchestration
\`/check_completeness orch-123 --detailed\` - Detailed check of specific orchestration
\`/check_completeness --report\` - Generate completion report

**Process:**
1. Creates fresh verification session for objectivity
2. Reviews all task completion status
3. Validates acceptance criteria fulfillment
4. Runs comprehensive test suite (unless skipped)
5. Generates structured completion report
6. Provides resumption recommendations

**Output:**
- Overall completion percentage
- Task completion breakdown
- Quality metrics and test results
- Identified gaps and missing requirements
- Recommendations for next steps`);
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

Use \`/check_completeness --help\` for more information.`);
          return;
        }

        addInfoMessage(commandContext, `🔍 **Starting Completeness Verification**

**Orchestration ID:** ${orchestrationId}
**Analysis Mode:** ${parsedArgs.detailed ? 'Detailed' : 'Standard'}
**Test Execution:** ${parsedArgs.skipTests ? 'Skipped' : 'Enabled'}

Creating fresh verification session for objective assessment...`);

        // Create verification service
        const contextLoader = new ContextLoader(
          context.sessionRegistry,
          context.taskManifest
        );

        const verificationService = new VerificationService(
          context.sessionRegistry,
          context.taskManifest,
          contextLoader
        );

        // Load orchestration context for verification
        const verificationContext = await contextLoader.loadVerificationContext(
          orchestrationId,
          parsedArgs.detailed
        );

        if (!verificationContext) {
          addErrorMessage(commandContext, `❌ **Orchestration Not Found**

Orchestration "${orchestrationId}" does not exist or has no sessions.

Use \`/sessions\` to see available orchestrations.`);
          return;
        }

        // Create verification session
        const sessionParams: CreateSessionParams = {
          type: SessionType.VERIFICATION,
          orchestrationId,
          initialFocus: 'Project completion verification',
          metadata: {
            name: 'Completion Verification',
            description: 'Comprehensive project completion assessment',
            tags: ['verification', 'completion', 'assessment'],
            userMetadata: {
              verificationMode: parsedArgs.detailed ? 'detailed' : 'standard',
              skipTests: parsedArgs.skipTests,
              generateReport: parsedArgs.generateReport,
            },
          },
        };

        const verificationSession = await context.sessionRegistry.createSession(sessionParams);

        addInfoMessage(commandContext, `📊 **Analyzing Project Status**

**Verification Session:** ${verificationSession.id}
**Total Sessions:** ${verificationContext.childContexts?.length || 0}
**Related Tasks:** ${verificationContext.relatedTasks?.length || 0}

Performing comprehensive analysis...`);

        // Perform verification
        const verificationResult = await verificationService.performCompletionVerification(
          orchestrationId,
          {
            detailed: parsedArgs.detailed || false,
            skipTests: parsedArgs.skipTests || false,
            generateReport: parsedArgs.generateReport || false,
            verificationSessionId: verificationSession.id,
          }
        );

        if (verificationResult.success) {
          const report = verificationResult.report!;

          // Format completion status
          const completionIcon = report.completionPercentage >= 100 ? '✅' :
                                report.completionPercentage >= 80 ? '🟡' : '🔴';

          const qualityIcon = (report.qualityScore || 0) >= 90 ? '✅' :
                            (report.qualityScore || 0) >= 70 ? '🟡' : '🔴';

          addInfoMessage(commandContext, `${completionIcon} **Completion Verification Results**

**Overall Status:** ${report.overallStatus}
**Completion:** ${report.completionPercentage}% ${completionIcon}
**Quality Score:** ${report.qualityScore || 'N/A'}% ${qualityIcon}

**Task Breakdown:**
${verificationResult.taskSummary?.map(task =>
  `${task.status === TaskStatus.COMPLETED ? '✅' :
    task.status === TaskStatus.IN_PROGRESS ? '🔄' :
    task.status === TaskStatus.BLOCKED ? '🚫' : '⏳'} ${task.name} (${task.status})`
).join('\n') || 'No tasks found'}

**Verification Checks:**
${report.checks.map(check =>
  `${check.status === 'passed' ? '✅' :
    check.status === 'failed' ? '❌' :
    check.status === 'pending' ? '⏳' : '⚠️'} ${check.name}`
).join('\n')}

${report.issues.length > 0 ? `**Issues Found:**
${report.issues.map(issue =>
  `${issue.severity === 'critical' ? '🔴' :
    issue.severity === 'high' ? '🟠' :
    issue.severity === 'medium' ? '🟡' : '🔵'} ${issue.title}`
).join('\n')}` : ''}

${(report.resumptionRecommendations || []).length > 0 ? `**Recommendations:**
${(report.resumptionRecommendations || []).map(rec =>
  `${rec.priority === 'critical' ? '🔴' :
    rec.priority === 'high' ? '🟠' :
    rec.priority === 'medium' ? '🟡' : '🔵'} ${rec.description}`
).join('\n')}` : ''}

${verificationResult.nextSteps.length > 0 ? `**Next Steps:**
${verificationResult.nextSteps.map(step => `• ${step}`).join('\n')}` : ''}`);

          if (parsedArgs.generateReport && verificationResult.reportPath) {
            addInfoMessage(commandContext, `📄 **Report Generated**

Detailed completion report saved to: \`${verificationResult.reportPath}\`

The report includes:
• Complete task analysis
• Quality metrics and test results
• Detailed issue breakdown
• Comprehensive recommendations
• Session history and artifacts`);
          }

        } else {
          addErrorMessage(commandContext, `❌ **Verification Failed**

${verificationResult.errors.map(error => `• ${error}`).join('\n')}

${verificationResult.warnings.length > 0 ? `\n**Warnings:**\n${verificationResult.warnings.map(w => `⚠️ ${w}`).join('\n')}` : ''}

Please address the issues above and try again.`);
        }

      } catch (error) {
        addErrorMessage(commandContext, `Completeness check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
