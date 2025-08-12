# Qwen Code Orchestrator User Guide

This guide provides comprehensive instructions for using the Qwen Code Orchestrator to manage complex development workflows.

## Getting Started

### Prerequisites

- Qwen Code CLI installed and configured
- Node.js 18+ for development projects
- Basic familiarity with command-line interfaces

### First Steps

1. **Verify Installation**
   ```bash
   qwen /orchestration_help
   ```

2. **Create Your First Plan**
   ```bash
   qwen /plan "Create a simple web server with Express.js"
   ```

3. **Review the Generated Plan**
   ```bash
   qwen /list_tasks
   ```

## Core Workflows

### Planning Workflow

The planning workflow uses sequential thinking to break down complex problems:

1. **Initiate Planning**
   ```bash
   qwen /plan "Build a user authentication system"
   ```

2. **Review Sequential Thinking**
   The system will:
   - Analyze the problem systematically
   - Break it into logical phases
   - Create detailed task lists
   - Estimate effort and dependencies

3. **Approve or Modify**
   ```bash
   qwen /approve_plan    # Accept the plan
   qwen /reset_plan      # Start over
   ```

### Task Execution Workflow

Once you have an approved plan:

1. **Start Next Task**
   ```bash
   qwen /new_task
   ```

2. **Monitor Progress**
   ```bash
   qwen /task_status
   qwen /list_tasks status:in_progress
   ```

3. **Check Overall Completion**
   ```bash
   qwen /check_completeness
   ```

### Session Management Workflow

Sessions help organize and track your work:

1. **List All Sessions**
   ```bash
   qwen /sessions
   qwen /sessions type:planning
   qwen /sessions state:active
   ```

2. **Resume Previous Work**
   ```bash
   qwen /resume session-1234567890-abc
   ```

3. **View Current Context**
   ```bash
   qwen /context
   qwen /session_history
   ```

## Advanced Features

### Session Hierarchies

Organize complex projects with session hierarchies:

```bash
# Start main planning session
qwen /plan "Build e-commerce platform"

# Create focused sub-sessions
qwen /plan "Implement user authentication" --parent current

# Navigate between sessions
qwen /sessions --tree
qwen /resume parent-session-id
```

### Task Dependencies

The orchestrator automatically manages task dependencies:

- **Prerequisites**: Tasks that must complete first
- **Blockers**: Issues preventing task completion
- **Parallel tasks**: Tasks that can run simultaneously

### Custom Filters

Use filters to find specific sessions or tasks:

```bash
# Filter sessions
qwen /sessions type:planning state:active
qwen /sessions tag:frontend created:today

# Filter tasks
qwen /list_tasks priority:high status:pending
qwen /list_tasks assignee:me estimated:>4h
```

## Command Reference

### Planning Commands

#### `/plan <description>`
Creates a new development plan with sequential thinking.

**Options:**
- `--parent <session-id>`: Create as child session
- `--type <type>`: Session type (planning, task, verification)
- `--tags <tags>`: Comma-separated tags

**Examples:**
```bash
qwen /plan "Create REST API for blog posts"
qwen /plan "Add user authentication" --parent session-123
qwen /plan "Implement caching layer" --tags backend,performance
```

#### `/approve_plan`
Approves the current plan and makes it ready for execution.

#### `/reset_plan`
Resets the current plan and starts planning over.

#### `/export_plan [format]`
Exports the current plan in specified format.

**Formats:**
- `json`: Machine-readable JSON
- `csv`: Spreadsheet-compatible CSV
- `markdown`: Human-readable Markdown

### Task Commands

#### `/new_task`
Starts the next available task in the current plan.

**Options:**
- `--task-id <id>`: Start specific task
- `--force`: Skip dependency checks

#### `/list_tasks [filter]`
Lists tasks with optional filtering.

**Filter syntax:**
- `status:pending`: Filter by status
- `priority:high`: Filter by priority
- `assignee:me`: Filter by assignee
- `tag:frontend`: Filter by tag

#### `/task_status [task-id]`
Shows detailed status for a task.

### Session Commands

#### `/sessions [filter]`
Lists sessions with optional filtering.

**Options:**
- `--tree`: Show hierarchical view
- `--cleanup`: Remove completed sessions
- `--recover`: Attempt to recover corrupted sessions

#### `/resume <session-id>`
Resumes a specific session.

#### `/context`
Shows current session context and state.

**Options:**
- `--debug`: Show detailed debugging information
- `--export`: Export context to file

#### `/session_history`
Shows navigation history for current orchestration.

## Best Practices

### Effective Planning

1. **Start with Clear Goals**
   - Be specific about what you want to achieve
   - Include success criteria in your description
   - Consider the scope and complexity

2. **Trust the Sequential Thinking**
   - Let the system break down complex problems
   - Review the thinking process for insights
   - Adjust the plan if needed before approval

3. **Use Descriptive Names**
   - Name sessions clearly for easy identification
   - Use tags to categorize related work
   - Include context in task descriptions

### Session Organization

1. **Create Logical Hierarchies**
   - Use parent sessions for major features
   - Create child sessions for specific components
   - Keep related work together

2. **Regular Cleanup**
   - Archive completed sessions
   - Remove failed or abandoned sessions
   - Export important plans before cleanup

3. **Consistent Naming**
   - Use consistent naming conventions
   - Include project names in session titles
   - Add dates for time-sensitive work

### Task Management

1. **Follow Dependencies**
   - Complete prerequisite tasks first
   - Don't skip dependency checks
   - Update task status regularly

2. **Monitor Progress**
   - Check task status frequently
   - Update completion percentages
   - Document blockers and issues

3. **Verify Completion**
   - Use acceptance criteria to verify tasks
   - Run `/check_completeness` regularly
   - Test implementations thoroughly

## Troubleshooting

### Common Issues

#### Session Won't Load
```bash
# Check session exists
qwen /sessions | grep session-id

# Try recovery
qwen /sessions --recover

# Check file permissions
ls -la .qwen/orchestration/sessions/
```

#### Plan Generation Fails
```bash
# Provide more context
qwen /plan "Detailed description with specific requirements"

# Check current context
qwen /context

# Try simpler description
qwen /plan "Simple, focused task description"
```

#### Task Execution Stuck
```bash
# Check dependencies
qwen /task_status task-id

# Review acceptance criteria
qwen /list_tasks --details

# Check for blockers
qwen /context --debug
```

### Error Recovery

The orchestrator includes automatic error recovery:

1. **Automatic Backups**: Created before risky operations
2. **Smart Repair**: Fixes common JSON corruption
3. **Validation**: Ensures data consistency
4. **Recovery Suggestions**: Provides step-by-step guidance

### Getting Help

- **Command Help**: `qwen /orchestration_help`
- **Context Debug**: `qwen /context --debug`
- **Session Recovery**: `qwen /sessions --recover`
- **Log Files**: Check `.qwen/orchestration/logs/`

## Integration Tips

### Working with Existing Tools

The orchestrator integrates seamlessly with:

- **Git**: Automatic commit suggestions
- **Package Managers**: Dependency installation
- **Testing Frameworks**: Test execution and validation
- **CI/CD**: Integration with build pipelines

### Custom Workflows

Create custom workflows by:

1. **Combining Commands**: Chain orchestration commands
2. **Using Scripts**: Automate common sequences
3. **Custom Tags**: Organize work by project or team
4. **Export/Import**: Share plans between team members

## Examples

See the `examples/` directory for complete workflow examples:

- **Web Application**: Full-stack development workflow
- **API Development**: REST API creation and testing
- **Library Creation**: Package development and publishing
- **Bug Fixes**: Systematic debugging and resolution
- **Refactoring**: Code improvement workflows

## Next Steps

1. **Practice with Simple Projects**: Start with small, focused tasks
2. **Explore Advanced Features**: Try session hierarchies and custom filters
3. **Integrate with Your Workflow**: Adapt to your development process
4. **Share and Collaborate**: Use export/import for team coordination

For more advanced topics, see:
- [API Reference](API_REFERENCE.md)
- [Architecture Guide](ARCHITECTURE.md)
- [Contributing Guide](../CONTRIBUTING.md)
