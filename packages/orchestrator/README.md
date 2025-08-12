# Qwen Code Orchestrator

The Qwen Code Orchestrator is a sophisticated session management and task orchestration system that enables structured, multi-step development workflows with persistent state management and intelligent context handling.

## Overview

The orchestrator provides:

- **Session Management**: Persistent sessions with state tracking and recovery
- **Sequential Thinking**: Structured problem-solving with step-by-step reasoning
- **Task Orchestration**: Automated task decomposition and execution
- **Plan Management**: Development plan creation, tracking, and verification
- **Error Recovery**: Robust error handling with automatic recovery mechanisms

## Quick Start

### Basic Workflow

1. **Start a planning session**:
   ```bash
   qwen /plan "Create a REST API for user management"
   ```

2. **Review and approve the plan**:
   ```bash
   qwen /list_tasks
   qwen /approve_plan
   ```

3. **Execute tasks**:
   ```bash
   qwen /new_task
   ```

4. **Check progress**:
   ```bash
   qwen /task_status
   qwen /check_completeness
   ```

### Session Management

- **List all sessions**: `qwen /sessions`
- **Resume a session**: `qwen /resume <session-id>`
- **View session context**: `qwen /context`
- **Session history**: `qwen /session_history`

## Core Concepts

### Sessions

Sessions are persistent containers for development work that maintain:
- **Context**: Current focus, decisions, and progress
- **State**: Active, suspended, completed, or failed
- **Relationships**: Parent-child session hierarchies
- **Metadata**: Names, descriptions, and tags

### Sequential Thinking

The orchestrator uses structured thinking processes for complex tasks:
- **Step-by-step reasoning**: Breaking down problems systematically
- **Context preservation**: Maintaining thinking state across sessions
- **Adaptive planning**: Adjusting plans based on new information

### Task Manifests

JSON-based task tracking with:
- **Dependencies**: Task relationships and prerequisites
- **Progress tracking**: Completion percentages and status
- **Acceptance criteria**: Clear completion requirements
- **Estimation**: Effort estimates and confidence levels

## Commands Reference

### Planning Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/plan <description>` | Create a development plan | `/plan "Build user authentication"` |
| `/approve_plan` | Approve the current plan | `/approve_plan` |
| `/reset_plan` | Reset the current plan | `/reset_plan` |
| `/export_plan [format]` | Export plan (json/csv/markdown) | `/export_plan markdown` |

### Task Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/new_task` | Start the next available task | `/new_task` |
| `/list_tasks [filter]` | List tasks with optional filter | `/list_tasks status:pending` |
| `/task_status [task-id]` | Show task status | `/task_status task-123` |
| `/check_completeness` | Verify plan completion | `/check_completeness` |

### Session Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/sessions [filter]` | List sessions | `/sessions type:planning` |
| `/resume <session-id>` | Resume a session | `/resume session-123` |
| `/context` | Show current session context | `/context` |
| `/session_history` | Show session navigation history | `/session_history` |

## Architecture

### Core Components

```
packages/orchestrator/
├── src/
│   ├── commands/           # CLI command implementations
│   ├── session/           # Session management
│   ├── state/             # Persistent storage
│   ├── planning/          # Plan generation and management
│   ├── execution/         # Task execution
│   ├── verification/      # Completion verification
│   ├── tools/             # Sequential thinking tools
│   ├── types/             # TypeScript interfaces
│   └── utils/             # Utilities and helpers
├── docs/                  # Documentation
└── tests/                 # Test suites
```

### Data Flow

1. **Command Input** → CLI command parser
2. **Session Loading** → State manager retrieves session
3. **Context Application** → Session context loaded
4. **Operation Execution** → Command logic executed
5. **State Persistence** → Updated state saved
6. **Response** → Results returned to user

## Configuration

The orchestrator stores data in `.qwen/orchestration/`:

```
.qwen/orchestration/
├── sessions/              # Session files
├── manifests/             # Task manifests
├── plans/                 # Development plans
├── backups/               # Automatic backups
└── config.json            # Configuration
```

### Configuration Options

```json
{
  "enableBackups": true,
  "maxSessions": 100,
  "sessionTimeout": "24h",
  "autoCleanup": true,
  "thinkingDepth": "deep"
}
```

## Error Handling

The orchestrator includes comprehensive error handling:

### Automatic Recovery

- **Session corruption**: Automatic backup restoration
- **JSON parsing errors**: Smart repair attempts
- **State inconsistencies**: Validation and correction
- **Missing dependencies**: Dependency resolution

### Error Types

- **SessionNotFound**: Session doesn't exist
- **SessionCorrupted**: Session data is invalid
- **TaskNotFound**: Task doesn't exist
- **ValidationError**: Data validation failed
- **StorageError**: File system issues
- **StateTransitionError**: Invalid state change

### Recovery Actions

When errors occur, the system provides:
- **Automatic fixes**: When possible
- **Recovery suggestions**: Step-by-step guidance
- **Backup options**: Restore from previous state
- **Manual intervention**: Clear instructions

## Best Practices

### Session Management

1. **Use descriptive names**: Help identify sessions later
2. **Regular checkpoints**: Save progress frequently
3. **Clean up completed sessions**: Remove old sessions
4. **Use session hierarchy**: Organize related work

### Planning

1. **Start with high-level goals**: Break down incrementally
2. **Define clear acceptance criteria**: Know when tasks are done
3. **Estimate effort realistically**: Include buffer time
4. **Review and adjust**: Plans can evolve

### Task Execution

1. **Follow the plan**: Trust the sequential thinking
2. **Update progress**: Keep status current
3. **Document decisions**: Record important choices
4. **Test incrementally**: Verify as you go

## Troubleshooting

### Common Issues

**Session won't load**:
- Check session ID format
- Verify file permissions
- Try session recovery: `/sessions --recover`

**Plan generation fails**:
- Ensure clear problem description
- Check available context
- Try breaking down the problem

**Task execution stuck**:
- Check task dependencies
- Verify acceptance criteria
- Review error logs

### Getting Help

- **Command help**: `qwen /orchestration_help`
- **Session diagnostics**: `qwen /context --debug`
- **Error details**: Check `.qwen/orchestration/logs/`

## Examples

See the `docs/examples/` directory for:
- **Basic workflows**: Simple task orchestration
- **Complex projects**: Multi-session development
- **Integration patterns**: Working with existing tools
- **Custom configurations**: Advanced setups

## Contributing

See `CONTRIBUTING.md` for development guidelines and contribution instructions.

## License

Copyright 2025 Google LLC. Licensed under the Apache License, Version 2.0.
