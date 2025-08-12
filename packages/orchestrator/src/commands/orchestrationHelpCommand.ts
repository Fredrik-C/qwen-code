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
  addInfoMessage 
} from './OrchestrationCommandLoader.js';

/**
 * /orchestration_help command - Comprehensive help for orchestration features
 */
export function orchestrationHelpCommand(context: OrchestrationContext): SlashCommand {
  return {
    name: 'orchestration_help',
    altNames: ['orch_help', 'orch'],
    description: 'Comprehensive help for orchestration features and workflow',
    kind: CommandKind.ORCHESTRATION,
    action: async (commandContext: CommandContext, args: string) => {
      const helpContent = `🎯 **Qwen Code Orchestration System**

The orchestration system provides structured development planning and execution with sequential thinking integration.

## 📋 **Core Workflow**

1. **Planning Phase**
   \`/plan <description>\` - Create a development plan with sequential thinking
   \`/approve_plan\` - Approve and finalize the current plan
   \`/reset_plan\` - Reset and restart planning

2. **Execution Phase**
   \`/new_task\` - Start working on the next task
   \`/task_status\` - Check current progress and metrics
   \`/list_tasks\` - View all tasks and their status

3. **Verification Phase**
   \`/check_completeness\` - Verify project completion
   \`/export_plan\` - Export plan and results

## 🔧 **Session Management**

\`/sessions\` - List and manage orchestration sessions
\`/resume <session_id>\` - Resume a paused session
\`/context\` - Show current session context
\`/session_history\` - View session progression

## 📊 **Task Management**

**List Tasks:**
- \`/list_tasks\` - Show all tasks
- \`/list_tasks --status in_progress\` - Filter by status
- \`/list_tasks --format summary\` - Show summary view

**Task Status:**
- \`/task_status\` - Overall orchestration status
- \`/task_status --detailed\` - Detailed progress information

## 🎯 **Planning Features**

**Sequential Thinking Integration:**
- Mandatory structured thinking for all planning operations
- Automatic context preservation across sessions
- Decision tracking and rationale capture

**Plan Management:**
- Hierarchical task breakdown
- Dependency management
- Progress tracking and estimation

## 🔄 **Session Features**

**Session Types:**
- **Planning**: Strategic thinking and plan creation
- **Task**: Implementation and execution
- **Verification**: Testing and validation
- **Interactive**: General development work

**Session Navigation:**
- Parent-child session relationships
- Session history and timeline
- Context preservation and restoration

## 💡 **Best Practices**

1. **Start with Planning**
   Always begin with \`/plan\` to establish clear objectives

2. **Use Sequential Thinking**
   Let the system guide you through structured thinking

3. **Track Progress**
   Regularly check \`/task_status\` and \`/list_tasks\`

4. **Manage Sessions**
   Use \`/sessions\` to organize your work

5. **Verify Completion**
   Use \`/check_completeness\` before finishing

## 🚀 **Quick Start**

\`\`\`
# 1. Create a new plan
/plan "Implement user authentication system"

# 2. Start working on tasks
/new_task

# 3. Check progress
/task_status

# 4. Verify completion
/check_completeness
\`\`\`

## 🔍 **Command Reference**

**Planning Commands:**
- \`/plan\` - Create development plan
- \`/approve_plan\` - Approve current plan
- \`/reset_plan\` - Reset planning

**Execution Commands:**
- \`/new_task\` - Start next task
- \`/list_tasks\` - View task list
- \`/task_status\` - Check progress

**Session Commands:**
- \`/sessions\` - Manage sessions
- \`/resume\` - Resume session
- \`/context\` - Show context

**Verification Commands:**
- \`/check_completeness\` - Verify completion
- \`/export_plan\` - Export results

Use \`/<command> --help\` for detailed help on any command.

---
*The orchestration system enforces best practices through structured workflows and sequential thinking integration.*`;

      addInfoMessage(commandContext, helpContent);
    },
  };
}
