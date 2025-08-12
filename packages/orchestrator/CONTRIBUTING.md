# Contributing to Qwen Code Orchestrator

Thank you for your interest in contributing to the Qwen Code Orchestrator! This guide will help you get started with development and contribution.

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git
- TypeScript knowledge
- Familiarity with CLI development

### Getting Started

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/qwen-code.git
   cd qwen-code/packages/orchestrator
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Package**
   ```bash
   npm run build
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Start Development**
   ```bash
   npm run dev
   ```

## Project Structure

```
packages/orchestrator/
├── src/
│   ├── commands/           # CLI command implementations
│   │   ├── planCommand.ts
│   │   ├── newTaskCommand.ts
│   │   └── ...
│   ├── session/           # Session management
│   │   ├── OrchestrationSession.ts
│   │   ├── SessionRegistry.ts
│   │   └── ...
│   ├── state/             # Persistent storage
│   │   ├── StateManager.ts
│   │   ├── TaskManifest.ts
│   │   └── ...
│   ├── planning/          # Plan generation
│   ├── execution/         # Task execution
│   ├── verification/      # Completion verification
│   ├── tools/             # Sequential thinking tools
│   ├── types/             # TypeScript interfaces
│   └── utils/             # Utilities and helpers
├── docs/                  # Documentation
├── tests/                 # Test suites
├── examples/              # Usage examples
└── package.json
```

## Development Guidelines

### Code Style

We use TypeScript with strict type checking and follow these conventions:

1. **Naming Conventions**
   - Classes: PascalCase (`OrchestrationSession`)
   - Functions/methods: camelCase (`createSession`)
   - Constants: UPPER_SNAKE_CASE (`MAX_SESSIONS`)
   - Files: camelCase (`sessionRegistry.ts`)

2. **Type Safety**
   - Always use TypeScript types
   - Avoid `any` type unless absolutely necessary
   - Use strict null checks
   - Define interfaces for all data structures

3. **Error Handling**
   - Use custom error classes
   - Provide meaningful error messages
   - Include recovery suggestions
   - Log errors appropriately

### Code Organization

1. **Single Responsibility**
   - Each class/function has one clear purpose
   - Keep functions small and focused
   - Separate concerns into different modules

2. **Dependency Injection**
   - Use constructor injection for dependencies
   - Avoid global state
   - Make dependencies explicit

3. **Interface Segregation**
   - Define focused interfaces
   - Avoid large, monolithic interfaces
   - Use composition over inheritance

### Testing

1. **Test Coverage**
   - Aim for >90% test coverage
   - Test both happy path and error cases
   - Include integration tests

2. **Test Structure**
   ```typescript
   describe('ComponentName', () => {
     describe('methodName', () => {
       it('should do something specific', () => {
         // Test implementation
       })
     })
   })
   ```

3. **Test Data**
   - Use factories for test data
   - Clean up after tests
   - Isolate tests from each other

## Contributing Process

### 1. Issue Creation

Before starting work:

1. **Check Existing Issues**: Look for existing issues or discussions
2. **Create Issue**: If none exists, create a detailed issue describing:
   - Problem or feature request
   - Expected behavior
   - Current behavior (for bugs)
   - Proposed solution (for features)

### 2. Development Workflow

1. **Create Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

2. **Make Changes**
   - Follow coding guidelines
   - Write tests for new functionality
   - Update documentation as needed

3. **Test Changes**
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new session management feature"
   ```

   Use conventional commit format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `test:` for tests
   - `refactor:` for refactoring

### 3. Pull Request Process

1. **Create Pull Request**
   - Use descriptive title
   - Include detailed description
   - Reference related issues
   - Add screenshots if applicable

2. **PR Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Tests pass
   - [ ] New tests added
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   ```

3. **Review Process**
   - Address review feedback
   - Update tests if needed
   - Ensure CI passes

## Adding New Features

### New Commands

1. **Create Command File**
   ```typescript
   // src/commands/myNewCommand.ts
   export const myNewCommand: OrchestrationCommand = {
     name: 'my_new_command',
     description: 'Description of what it does',
     usage: '/my_new_command [options]',
     examples: [
       '/my_new_command --option value'
     ],
     action: createOrchestrationAction(async (context, commandContext, args) => {
       // Implementation
     })
   }
   ```

2. **Register Command**
   ```typescript
   // src/commands/OrchestrationCommandLoader.ts
   import { myNewCommand } from './myNewCommand.js'
   
   export function loadOrchestrationCommands(): OrchestrationCommand[] {
     return [
       // ... existing commands
       myNewCommand
     ]
   }
   ```

3. **Add Tests**
   ```typescript
   // src/commands/__tests__/myNewCommand.test.ts
   describe('myNewCommand', () => {
     it('should execute successfully', async () => {
       // Test implementation
     })
   })
   ```

### New Session Types

1. **Define Type**
   ```typescript
   // src/types/session.ts
   export enum SessionType {
     // ... existing types
     MY_NEW_TYPE = 'my_new_type'
   }
   ```

2. **Extend Session Logic**
   ```typescript
   // src/session/SessionRegistry.ts
   async createMyNewTypeSession(params: MyNewTypeParams) {
     return this.createSession({
       ...params,
       type: SessionType.MY_NEW_TYPE
     })
   }
   ```

3. **Add Validation**
   ```typescript
   // src/utils/ValidationUtils.ts
   // Add validation rules for new session type
   ```

## Documentation

### Code Documentation

1. **JSDoc Comments**
   ```typescript
   /**
    * Creates a new orchestration session
    * @param params - Session creation parameters
    * @returns Promise resolving to created session
    * @throws {ValidationError} When parameters are invalid
    */
   async createSession(params: CreateSessionParams): Promise<OrchestrationSession>
   ```

2. **README Updates**
   - Update main README for new features
   - Add examples for new commands
   - Update command reference

3. **API Documentation**
   - Update API_REFERENCE.md
   - Include new interfaces and types
   - Add usage examples

### User Documentation

1. **User Guide**
   - Add new workflows
   - Update command descriptions
   - Include troubleshooting tips

2. **Examples**
   - Create practical examples
   - Show real-world usage
   - Include expected outputs

## Testing Guidelines

### Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionRegistry } from '../SessionRegistry.js'

describe('SessionRegistry', () => {
  let sessionRegistry: SessionRegistry

  beforeEach(() => {
    sessionRegistry = new SessionRegistry(mockStateManager)
  })

  it('should create session successfully', async () => {
    const session = await sessionRegistry.createSession({
      type: SessionType.PLANNING,
      orchestrationId: 'test-123'
    })

    expect(session.id).toBeDefined()
    expect(session.type).toBe(SessionType.PLANNING)
  })
})
```

### Integration Tests

```typescript
describe('End-to-End Workflow', () => {
  it('should complete planning workflow', async () => {
    // Test complete user workflow
    const planResult = await executePlanCommand('Create web server')
    expect(planResult.success).toBe(true)

    const tasks = await executeListTasksCommand()
    expect(tasks.length).toBeGreaterThan(0)

    const approveResult = await executeApproveCommand()
    expect(approveResult.success).toBe(true)
  })
})
```

## Release Process

### Version Management

We use semantic versioning (semver):
- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes

### Release Steps

1. **Update Version**
   ```bash
   npm version patch|minor|major
   ```

2. **Update Changelog**
   - Document all changes
   - Include breaking changes
   - Add migration guide if needed

3. **Create Release**
   - Tag the release
   - Create GitHub release
   - Include release notes

## Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Request Reviews**: Code-specific discussions

### Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

### Our Standards

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain professional communication

Thank you for contributing to the Qwen Code Orchestrator!
