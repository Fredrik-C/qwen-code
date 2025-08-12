# Basic Workflow Examples

This document provides step-by-step examples of common orchestrator workflows.

## Example 1: Creating a Simple Web Server

### Scenario
You want to create a basic Express.js web server with a few endpoints.

### Step 1: Start Planning
```bash
qwen /plan "Create a simple Express.js web server with user management endpoints"
```

**Expected Output:**
```
🤔 Starting sequential thinking for planning...

## 1. Mission
Create a simple Express.js web server with user management endpoints

## 2. Mission Decomposition
### Phase 1: Project Setup
#### 1.1. Initialize Node.js project
#### 1.2. Install Express.js and dependencies
#### 1.3. Set up basic project structure

### Phase 2: Core Server Implementation
#### 2.1. Create basic Express server
#### 2.2. Set up middleware (CORS, JSON parsing)
#### 2.3. Implement health check endpoint

### Phase 3: User Management
#### 3.1. Design user data structure
#### 3.2. Implement GET /users endpoint
#### 3.3. Implement POST /users endpoint
#### 3.4. Implement PUT /users/:id endpoint
#### 3.5. Implement DELETE /users/:id endpoint

### Phase 4: Testing and Documentation
#### 4.1. Add basic error handling
#### 4.2. Create API documentation
#### 4.3. Add basic tests

✅ Planning complete! Generated 12 tasks across 4 phases.
```

### Step 2: Review the Plan
```bash
qwen /list_tasks
```

**Expected Output:**
```
📋 Task Manifest for orchestration-1234567890

Phase 1: Project Setup (3 tasks)
├── [⏳] task-001: Initialize Node.js project
├── [⏳] task-002: Install Express.js and dependencies  
└── [⏳] task-003: Set up basic project structure

Phase 2: Core Server Implementation (3 tasks)
├── [⏳] task-004: Create basic Express server
├── [⏳] task-005: Set up middleware (CORS, JSON parsing)
└── [⏳] task-006: Implement health check endpoint

Phase 3: User Management (4 tasks)
├── [⏳] task-007: Design user data structure
├── [⏳] task-008: Implement GET /users endpoint
├── [⏳] task-009: Implement POST /users endpoint
├── [⏳] task-010: Implement PUT /users/:id endpoint
└── [⏳] task-011: Implement DELETE /users/:id endpoint

Phase 4: Testing and Documentation (2 tasks)
├── [⏳] task-012: Add basic error handling
├── [⏳] task-013: Create API documentation
└── [⏳] task-014: Add basic tests

📊 Statistics:
- Total: 14 tasks
- Not Started: 14 (100%)
- Estimated Time: 8-12 hours
```

### Step 3: Approve the Plan
```bash
qwen /approve_plan
```

**Expected Output:**
```
✅ Plan approved! Ready to begin implementation.

Next steps:
1. Run `/new_task` to start the first task
2. Use `/task_status` to monitor progress
3. Use `/check_completeness` to verify completion
```

### Step 4: Start First Task
```bash
qwen /new_task
```

**Expected Output:**
```
🚀 Starting task: Initialize Node.js project

📝 Task Details:
- ID: task-001
- Name: Initialize Node.js project
- Priority: High
- Estimated Time: 30 minutes

🎯 Acceptance Criteria:
- [ ] package.json file created
- [ ] Basic project structure established
- [ ] Git repository initialized

🔄 Creating new task session...
Session ID: session-1234567891-task001

Let me help you initialize the Node.js project:

1. First, I'll create a package.json file:
```

### Step 5: Monitor Progress
```bash
qwen /task_status
```

**Expected Output:**
```
📊 Current Task Status

🔄 Active Task: task-001 - Initialize Node.js project
├── Status: In Progress (25% complete)
├── Session: session-1234567891-task001
├── Started: 2025-01-12 10:30:00
├── Estimated Completion: 2025-01-12 11:00:00

✅ Completed Steps:
- Created package.json with basic configuration
- Set up .gitignore file

🔄 Current Step:
- Initializing Git repository

⏳ Remaining Steps:
- Set up basic directory structure
- Create initial README.md
```

### Step 6: Continue with Next Tasks
```bash
# After first task completes
qwen /new_task

# Check overall progress
qwen /check_completeness
```

**Expected Output:**
```
📈 Project Completion Status

🎯 Overall Progress: 2/14 tasks completed (14%)

✅ Completed Phases:
- None yet

🔄 Current Phase: Project Setup (2/3 tasks complete)
├── [✅] task-001: Initialize Node.js project
├── [✅] task-002: Install Express.js and dependencies
└── [🔄] task-003: Set up basic project structure (In Progress)

⏳ Upcoming Phases:
- Phase 2: Core Server Implementation (0/3 tasks)
- Phase 3: User Management (0/4 tasks)
- Phase 4: Testing and Documentation (0/2 tasks)

🕒 Estimated Remaining Time: 6-8 hours
```

## Example 2: Bug Fix Workflow

### Scenario
You need to fix a bug in an existing application.

### Step 1: Start Investigation
```bash
qwen /plan "Fix the user authentication bug where users can't log in with special characters in passwords"
```

### Step 2: Review Generated Investigation Plan
```bash
qwen /list_tasks
```

**Expected Output:**
```
🔍 Bug Fix Plan for orchestration-1234567892

Phase 1: Investigation (4 tasks)
├── [⏳] task-001: Reproduce the bug
├── [⏳] task-002: Analyze authentication code
├── [⏳] task-003: Identify root cause
└── [⏳] task-004: Design fix strategy

Phase 2: Implementation (3 tasks)
├── [⏳] task-005: Implement password encoding fix
├── [⏳] task-006: Update validation logic
└── [⏳] task-007: Add input sanitization

Phase 3: Testing (3 tasks)
├── [⏳] task-008: Create test cases for special characters
├── [⏳] task-009: Run regression tests
└── [⏳] task-010: Manual testing verification

Phase 4: Documentation (2 tasks)
├── [⏳] task-011: Update documentation
└── [⏳] task-012: Create bug fix summary
```

### Step 3: Execute Bug Fix
```bash
qwen /approve_plan
qwen /new_task
```

## Example 3: Feature Development

### Scenario
Adding a new feature to an existing application.

### Step 1: Feature Planning
```bash
qwen /plan "Add real-time notifications to the chat application using WebSockets"
```

### Step 2: Review and Customize
```bash
qwen /list_tasks

# If you want to modify the plan
qwen /reset_plan
qwen /plan "Add real-time notifications to the chat application using WebSockets, focusing on scalability and performance"
```

### Step 3: Parallel Development
```bash
# Start main feature development
qwen /approve_plan
qwen /new_task

# In another terminal, start documentation
qwen /plan "Create comprehensive documentation for the new notification system" --parent current
```

## Example 4: Code Refactoring

### Scenario
Refactoring legacy code for better maintainability.

### Step 1: Refactoring Plan
```bash
qwen /plan "Refactor the legacy user service to use modern TypeScript patterns and improve testability"
```

### Step 2: Incremental Approach
```bash
qwen /list_tasks

# The plan will break down refactoring into safe, incremental steps
# Each task will be small enough to test and verify independently
```

## Common Patterns

### Pattern 1: Iterative Development
```bash
# Start with MVP
qwen /plan "Create minimal viable product for task management app"
qwen /approve_plan

# Complete MVP
qwen /new_task  # Repeat until MVP done

# Extend with additional features
qwen /plan "Add advanced features to task management app" --parent current
```

### Pattern 2: Parallel Workstreams
```bash
# Main development
qwen /plan "Implement core application logic"

# Documentation workstream
qwen /plan "Create user documentation" --parent current

# Testing workstream  
qwen /plan "Develop comprehensive test suite" --parent current
```

### Pattern 3: Investigation and Implementation
```bash
# Research phase
qwen /plan "Research best practices for implementing real-time features"
qwen /approve_plan
# Complete research tasks...

# Implementation phase
qwen /plan "Implement real-time features based on research findings"
```

## Session Management Examples

### Switching Between Projects
```bash
# List all active sessions
qwen /sessions

# Resume specific project
qwen /resume session-1234567890-project1

# Check current context
qwen /context

# Switch to another project
qwen /resume session-1234567891-project2
```

### Session Organization
```bash
# Create project hierarchy
qwen /plan "Build e-commerce platform"  # Main project

# Create feature branches
qwen /plan "Implement user authentication" --parent current
qwen /plan "Add payment processing" --parent current
qwen /plan "Create admin dashboard" --parent current

# View session tree
qwen /sessions --tree
```

### Session Cleanup
```bash
# List completed sessions
qwen /sessions state:completed

# Clean up old sessions
qwen /sessions --cleanup

# Export important plans before cleanup
qwen /export_plan markdown > project-plan.md
```

## Tips for Effective Usage

### 1. Be Specific in Planning
```bash
# ❌ Too vague
qwen /plan "Make the app better"

# ✅ Specific and actionable
qwen /plan "Improve app performance by implementing caching, optimizing database queries, and reducing bundle size"
```

### 2. Use Descriptive Session Names
```bash
# ❌ Generic
qwen /plan "Fix bugs"

# ✅ Descriptive
qwen /plan "Fix authentication timeout issues in production environment"
```

### 3. Regular Progress Checks
```bash
# Check progress frequently
qwen /task_status
qwen /check_completeness

# Update task status when needed
qwen /list_tasks status:in_progress
```

### 4. Export and Share Plans
```bash
# Export for team review
qwen /export_plan markdown > team-review.md

# Export for documentation
qwen /export_plan json > project-manifest.json
```

These examples demonstrate the flexibility and power of the orchestrator for managing various types of development work, from simple tasks to complex multi-phase projects.
