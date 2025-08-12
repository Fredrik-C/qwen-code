# Qwen Code Orchestrator API Reference

This document provides detailed API reference for the Qwen Code Orchestrator components.

## Core Classes

### OrchestrationSession

The main session management class.

```typescript
class OrchestrationSession {
  constructor(params: CreateSessionParams)
  
  // Properties
  readonly id: string
  readonly type: SessionType
  readonly orchestrationId: string
  state: SessionState
  context: SessionContext
  metadata: SessionMetadata
  
  // Methods
  updateContext(updates: Partial<SessionContext>): void
  transition(newState: SessionState): void
  addDecision(decision: Decision): void
  setCurrentFocus(focus: string): void
  toJSON(): object
}
```

#### CreateSessionParams

```typescript
interface CreateSessionParams {
  type: SessionType
  orchestrationId: string
  taskId?: string
  parentSessionId?: string
  context?: Partial<SessionContext>
  metadata?: Partial<SessionMetadata>
}
```

#### SessionContext

```typescript
interface SessionContext {
  messages: Message[]
  artifacts: Artifact[]
  decisions: Decision[]
  currentFocus?: string
  sequentialThinking?: SequentialThinkingState
  variables?: Record<string, unknown>
}
```

### SessionRegistry

Manages multiple sessions and their relationships.

```typescript
class SessionRegistry {
  constructor(stateManager: StateManager)
  
  // Session Management
  createSession(params: CreateSessionParams): Promise<OrchestrationSession>
  getSession(sessionId: string): Promise<OrchestrationSession | null>
  updateSession(sessionId: string, updates: Partial<OrchestrationSession>): Promise<void>
  deleteSession(sessionId: string): Promise<void>
  
  // Querying
  querySessions(query: SessionQuery): Promise<OrchestrationSession[]>
  findRelatedSessions(sessionId: string): Promise<RelatedSessions>
  
  // Navigation
  getSessionNavigationHistory(orchestrationId: string): Promise<NavigationHistory>
  getSessionBreadcrumbs(sessionId: string): Promise<Breadcrumb[]>
  
  // Cleanup
  cleanupSessions(): Promise<CleanupResult>
}
```

#### SessionQuery

```typescript
interface SessionQuery {
  orchestrationId?: string
  type?: SessionType
  state?: SessionState
  parentSessionId?: string
  tags?: string[]
  createdAfter?: Date
  createdBefore?: Date
}
```

### TaskManifest

Manages task definitions and execution tracking.

```typescript
class TaskManifest {
  constructor(baseDir: string)
  
  // Task Management
  createTask(params: CreateTaskParams): Promise<Task>
  loadTask(taskId: string): Promise<Task | null>
  updateTask(taskId: string, updates: UpdateTaskParams): Promise<void>
  deleteTask(taskId: string): Promise<void>
  
  // Querying
  queryTasks(query: TaskQuery): Promise<Task[]>
  getNextTask(orchestrationId: string): Promise<Task | null>
  
  // Statistics
  getTaskStatistics(orchestrationId: string): Promise<TaskStatistics>
  
  // Validation
  validateTaskDependencies(orchestrationId: string): Promise<DependencyValidation>
  
  // Export
  exportTaskManifest(orchestrationId: string, format: ExportFormat): Promise<string>
}
```

#### Task

```typescript
interface Task {
  id: string
  name: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  orchestrationId: string
  dependencies: TaskDependency[]
  acceptanceCriteria: AcceptanceCriterion[]
  progress: TaskProgress
  estimation?: TaskEstimation
  assignee?: string
  tags?: string[]
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}
```

### StateManager

Handles persistent storage and state management.

```typescript
class StateManager {
  constructor(config: StateManagerConfig)
  
  // Session Storage
  saveSession(session: OrchestrationSession): Promise<void>
  loadSession(sessionId: string): Promise<OrchestrationSession | null>
  deleteSession(sessionId: string): Promise<void>
  listSessions(): Promise<string[]>
  
  // Task Storage
  saveTask(task: Task): Promise<void>
  loadTask(taskId: string): Promise<Task | null>
  deleteTask(taskId: string): Promise<void>
  
  // Plan Storage
  savePlan(plan: DevelopmentPlan): Promise<void>
  loadPlan(orchestrationId: string): Promise<DevelopmentPlan | null>
  
  // Backup Management
  createBackup(type: string, id: string): Promise<string>
  restoreFromBackup(backupPath: string): Promise<void>
  listBackups(): Promise<BackupInfo[]>
}
```

## Utility Classes

### ValidationUtils

Provides validation for all orchestrator data types.

```typescript
class ValidationUtils {
  // Session Validation
  static validateSession(session: any): SessionValidationResult
  static validateSessionId(id: string): boolean
  static validateStateTransition(from: SessionState, to: SessionState): TransitionValidation
  
  // Task Validation
  static validateTask(task: any): TaskValidationResult
  static validateTaskStatusTransition(from: TaskStatus, to: TaskStatus): TransitionValidation
  static validateTaskDependencies(tasks: any[]): DependencyValidation
  
  // Input Validation
  static sanitizeInput(input: string, maxLength?: number): string
  static validateOrchestrationId(id: string): boolean
  static validateTaskId(id: string): boolean
}
```

### ErrorHandler

Comprehensive error handling and recovery.

```typescript
class ErrorHandler {
  // Error Handling
  handleError(error: Error): Promise<ErrorRecoveryResult>
  
  // Recovery Actions
  private getRecoveryActions(error: OrchestrationError): RecoveryAction[]
  private attemptAutomaticRecovery(error: OrchestrationError): Promise<boolean>
}
```

#### OrchestrationError

```typescript
class OrchestrationError extends Error {
  constructor(
    type: OrchestrationErrorType,
    message: string,
    context?: Record<string, any>,
    recoverable?: boolean
  )
  
  readonly type: OrchestrationErrorType
  readonly context: Record<string, any>
  readonly recoverable: boolean
  readonly timestamp: Date
  
  toDisplayMessage(): string
}
```

### RecoveryUtils

Data recovery and backup utilities.

```typescript
class RecoveryUtils {
  // Backup Management
  static createBackup(filePath: string, reason: string): Promise<BackupMetadata>
  static listBackups(originalPath: string): Promise<BackupMetadata[]>
  static restoreFromBackup(backupPath: string, targetPath: string): Promise<RecoveryResult>
  
  // Data Recovery
  static recoverSessionFile(filePath: string): Promise<RecoveryResult>
  static recoverTaskManifestFile(filePath: string): Promise<RecoveryResult>
}
```

## Enums and Types

### SessionType

```typescript
enum SessionType {
  PLANNING = 'planning',
  TASK = 'task',
  VERIFICATION = 'verification',
  INTERACTIVE = 'interactive'
}
```

### SessionState

```typescript
enum SessionState {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  COMPLETED = 'completed',
  FAILED = 'failed'
}
```

### TaskStatus

```typescript
enum TaskStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}
```

### TaskPriority

```typescript
enum TaskPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}
```

### OrchestrationErrorType

```typescript
enum OrchestrationErrorType {
  SESSION_NOT_FOUND = 'session_not_found',
  SESSION_CORRUPTED = 'session_corrupted',
  TASK_NOT_FOUND = 'task_not_found',
  PLAN_NOT_FOUND = 'plan_not_found',
  STORAGE_ERROR = 'storage_error',
  VALIDATION_ERROR = 'validation_error',
  STATE_TRANSITION_ERROR = 'state_transition_error',
  DEPENDENCY_ERROR = 'dependency_error',
  EXECUTION_ERROR = 'execution_error'
}
```

## Command Interfaces

### Command Registration

```typescript
interface OrchestrationCommand {
  name: string
  description: string
  usage: string
  examples: string[]
  action: CommandAction
}

type CommandAction = (
  orchestrationContext: OrchestrationContext,
  commandContext: CommandContext,
  args: string
) => Promise<void | SlashCommandActionReturn>
```

### OrchestrationContext

```typescript
interface OrchestrationContext {
  sessionRegistry: SessionRegistry
  stateManager: StateManager
  taskManifest: TaskManifest
  currentSession?: OrchestrationSession
  currentOrchestrationId?: string
}
```

## Configuration

### StateManagerConfig

```typescript
interface StateManagerConfig {
  baseDir: string
  enableBackups: boolean
  maxBackups: number
  autoCleanup: boolean
  sessionTimeout: string
}
```

### OrchestrationConfig

```typescript
interface OrchestrationConfig {
  stateManager: StateManagerConfig
  thinkingDepth: 'shallow' | 'medium' | 'deep'
  autoApprove: boolean
  maxSessions: number
  defaultSessionType: SessionType
}
```

## Events

The orchestrator emits events for integration:

```typescript
interface OrchestrationEvents {
  'session:created': (session: OrchestrationSession) => void
  'session:updated': (session: OrchestrationSession) => void
  'session:completed': (session: OrchestrationSession) => void
  'task:created': (task: Task) => void
  'task:updated': (task: Task) => void
  'task:completed': (task: Task) => void
  'plan:created': (plan: DevelopmentPlan) => void
  'plan:approved': (plan: DevelopmentPlan) => void
  'error:occurred': (error: OrchestrationError) => void
  'recovery:attempted': (result: ErrorRecoveryResult) => void
}
```

## Usage Examples

### Creating a Session

```typescript
const sessionRegistry = new SessionRegistry(stateManager)

const session = await sessionRegistry.createSession({
  type: SessionType.PLANNING,
  orchestrationId: 'my-project-123',
  context: {
    currentFocus: 'Initial planning phase',
    messages: [],
    artifacts: [],
    decisions: []
  },
  metadata: {
    name: 'Project Planning Session',
    description: 'Planning for new feature development',
    tags: ['planning', 'feature-dev']
  }
})
```

### Managing Tasks

```typescript
const taskManifest = new TaskManifest('./tasks')

const task = await taskManifest.createTask({
  name: 'Implement user authentication',
  description: 'Create login/logout functionality',
  orchestrationId: 'my-project-123',
  priority: TaskPriority.HIGH,
  acceptanceCriteria: [
    { description: 'Users can log in with email/password', isMet: false },
    { description: 'Sessions are properly managed', isMet: false }
  ]
})

await taskManifest.updateTask(task.id, {
  status: TaskStatus.IN_PROGRESS,
  progress: { completionPercentage: 25 }
})
```

### Error Handling

```typescript
const errorHandler = new ErrorHandler()

try {
  await sessionRegistry.getSession('invalid-id')
} catch (error) {
  const recovery = await errorHandler.handleError(error)
  
  if (recovery.success) {
    console.log('Recovered:', recovery.message)
  } else {
    console.log('Recovery failed:', recovery.message)
    console.log('Suggested actions:', recovery.actions)
  }
}
```

For more examples, see the `examples/` directory in the package.
