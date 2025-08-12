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
import { TaskStatus } from '../types/task.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Parse export plan command arguments
 */
function parseExportPlanArgs(args: string): {
  orchestrationId?: string;
  format?: 'json' | 'csv' | 'markdown';
  outputPath?: string;
  includeProgress?: boolean;
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

    if (arg === '--format' || arg === '-f') {
      const format = argParts[++i];
      if (['json', 'csv', 'markdown'].includes(format)) {
        result.format = format;
      }
    } else if (arg === '--output' || arg === '-o') {
      result.outputPath = argParts[++i];
    } else if (arg === '--include-progress' || arg === '--progress') {
      result.includeProgress = true;
    } else if (arg === '--orchestration' || arg === '--orch') {
      result.orchestrationId = argParts[++i];
    } else if (!arg.startsWith('--') && !result.orchestrationId) {
      // First non-flag argument could be orchestration ID or format
      if (['json', 'csv', 'markdown'].includes(arg)) {
        result.format = arg;
      } else {
        result.orchestrationId = arg;
      }
    }
  }

  // Default format
  if (!result.format) {
    result.format = 'markdown';
  }

  return result;
}

/**
 * /export_plan command - Export orchestration artifacts
 */
export function exportPlanCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'export_plan',
    description: 'Export plan and tasks to files in multiple formats',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      try {
        const parsedArgs = parseExportPlanArgs(args);

        if (parsedArgs.help) {
          addInfoMessage(commandContext, `**Export Plan Command Usage:**

\`/export_plan [format] [orchestration_id]\`

**Options:**
- \`--format <format>\` - Export format: json, csv, markdown (default: markdown)
- \`--orchestration <id>\` - Specify orchestration ID to export
- \`--output <path>\` - Custom output file path
- \`--include-progress\` - Include detailed progress information
- \`--help\` - Show this help message

**Examples:**
\`/export_plan\` - Export current plan as markdown
\`/export_plan json\` - Export current plan as JSON
\`/export_plan --format csv --output ./my-plan.csv\` - Export as CSV to specific file
\`/export_plan markdown orch-123 --include-progress\` - Export specific plan with progress

**Export Formats:**

**JSON:** Machine-readable format for integration
- Complete plan and task data
- Suitable for backup and data processing
- Includes all metadata and relationships

**CSV:** Spreadsheet-compatible format
- Task list with key information
- Easy to import into project management tools
- Simplified view for reporting

**Markdown:** Human-readable documentation
- Formatted plan overview
- Task breakdown with status
- Suitable for documentation and sharing

**Output Location:**
Files are saved to the orchestration directory unless custom path specified.`);
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

Use \`/export_plan --help\` for more information.`);
          return;
        }

        addInfoMessage(commandContext, `📤 **Exporting Plan**

Orchestration ID: ${orchestrationId}
Format: ${parsedArgs.format}
Include Progress: ${parsedArgs.includeProgress ? 'Yes' : 'No'}

Generating export data...`);

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

        // Generate export data using TaskManifest export functionality
        let exportData: string;
        try {
          exportData = await context.taskManifest.exportTaskManifest(orchestrationId, parsedArgs.format!);
        } catch (error) {
          addErrorMessage(commandContext, `❌ **Export Generation Failed**

Failed to generate export data: ${error instanceof Error ? error.message : String(error)}

This may be due to:
1. Corrupted plan or task data
2. Missing task information
3. File system access issues

Please try again or check the orchestration logs.`);
          return;
        }

        // Determine output file path
        let outputPath: string;
        if (parsedArgs.outputPath) {
          outputPath = parsedArgs.outputPath;
        } else {
          // Default to orchestration directory
          const projectRoot = context.config.getProjectRoot();
          const baseDir = `${projectRoot}/.qwen/orchestration`;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `plan-export-${orchestrationId}-${timestamp}.${parsedArgs.format}`;
          outputPath = path.join(baseDir, 'exports', filename);
        }

        // Ensure export directory exists
        const exportDir = path.dirname(outputPath);
        try {
          await fs.mkdir(exportDir, { recursive: true });
        } catch (error) {
          addErrorMessage(commandContext, `❌ **Directory Creation Failed**

Failed to create export directory: ${exportDir}

Error: ${error instanceof Error ? error.message : String(error)}

Please check file system permissions or specify a different output path.`);
          return;
        }

        // Write export file
        try {
          await fs.writeFile(outputPath, exportData, 'utf-8');
        } catch (error) {
          addErrorMessage(commandContext, `❌ **File Write Failed**

Failed to write export file: ${outputPath}

Error: ${error instanceof Error ? error.message : String(error)}

Please check file system permissions or specify a different output path.`);
          return;
        }

        // Get file size for reporting
        let fileSize = 0;
        try {
          const stats = await fs.stat(outputPath);
          fileSize = stats.size;
        } catch (error) {
          // File size is not critical, continue
        }

        // Get task statistics for summary
        const taskStats = await context.taskManifest.getTaskStatistics(orchestrationId);

        addInfoMessage(commandContext, `✅ **Export Complete**

**Plan:** ${plan.name}
**Format:** ${parsedArgs.format?.toUpperCase()}
**File:** ${outputPath}
**Size:** ${fileSize > 0 ? `${Math.round(fileSize / 1024)} KB` : 'Unknown'}

**Export Summary:**
• Plan Status: ${plan.status}
• Total Tasks: ${taskStats.total}
• Completed: ${taskStats.byStatus[TaskStatus.COMPLETED] || 0}
• Requirements: ${plan.requirements.length}
• Phases: ${plan.phases.length}

**📁 File Location:**
\`${outputPath}\`

**Next Steps:**
• Open the file in your preferred application
• Share with team members or stakeholders
• Import into project management tools (for CSV format)
• Use as backup or documentation

The export includes ${parsedArgs.includeProgress ? 'detailed progress information and ' : ''}all plan and task data.`);

      } catch (error) {
        addErrorMessage(commandContext, `❌ **Export Error**

An unexpected error occurred during plan export:
${error instanceof Error ? error.message : String(error)}

Please try again or contact support if the issue persists.`);
      }
    },
  };
}
