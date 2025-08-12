/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  DevelopmentPlan, 
  CreatePlanParams, 
  PlanStatus, 
  PlanningPhase,
  Requirement,
  ArchitectureDecision,
  DevelopmentPhase,
  RiskAssessment,
  QualityGate
} from '../types/planning.js';
import { 
  SessionType, 
  SessionState, 
  CreateSessionParams 
} from '../types/session.js';
import { SessionRegistry } from '../session/SessionRegistry.js';
import { TaskManifest } from '../state/TaskManifest.js';
import { ThinkingToolIntegration } from './ThinkingToolIntegration.js';
import { OrchestrationSession } from '../session/OrchestrationSession.js';

/**
 * Planning workflow configuration
 */
export interface PlanningWorkflowConfig {
  /** Whether thinking is mandatory for planning */
  mandatoryThinking: boolean;
  /** Minimum thinking steps required */
  minThinkingSteps: number;
  /** Required thinking purposes for planning */
  requiredThinkingPurposes: string[];
  /** Whether to validate plan completeness */
  validateCompleteness: boolean;
  /** Whether to auto-approve simple plans */
  autoApproveSimple: boolean;
}

/**
 * Planning workflow result
 */
export interface PlanningWorkflowResult {
  success: boolean;
  plan?: DevelopmentPlan;
  session?: OrchestrationSession;
  thinkingSessionId?: string;
  errors: string[];
  warnings: string[];
  nextSteps: string[];
}

/**
 * Planning validation result
 */
export interface PlanningValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  missingElements: string[];
  recommendations: string[];
}

/**
 * Planning service with mandatory thinking workflow
 */
export class PlanningService {
  private sessionRegistry: SessionRegistry;
  private taskManifest: TaskManifest;
  private thinkingIntegration: ThinkingToolIntegration;
  private config: PlanningWorkflowConfig;

  constructor(
    sessionRegistry: SessionRegistry,
    taskManifest: TaskManifest,
    thinkingIntegration: ThinkingToolIntegration,
    config: PlanningWorkflowConfig = {
      mandatoryThinking: true,
      minThinkingSteps: 5,
      requiredThinkingPurposes: ['requirements_analysis', 'architecture_design', 'task_decomposition'],
      validateCompleteness: true,
      autoApproveSimple: false,
    }
  ) {
    this.sessionRegistry = sessionRegistry;
    this.taskManifest = taskManifest;
    this.thinkingIntegration = thinkingIntegration;
    this.config = config;
  }

  /**
   * Execute planning workflow with mandatory thinking
   */
  async executePlanningWorkflow(
    orchestrationId: string,
    planParams: CreatePlanParams,
    userInput: string
  ): Promise<PlanningWorkflowResult> {
    const result: PlanningWorkflowResult = {
      success: false,
      errors: [],
      warnings: [],
      nextSteps: [],
    };

    try {
      // Step 1: Create planning session
      const planningSession = await this.createPlanningSession(orchestrationId, planParams);
      result.session = planningSession;

      // Step 2: Enforce mandatory thinking
      if (this.config.mandatoryThinking) {
        const thinkingResult = await this.enforceMandatoryThinking(planningSession, userInput);
        
        if (!thinkingResult.success) {
          result.errors.push(...thinkingResult.errors);
          return result;
        }
        
        result.thinkingSessionId = thinkingResult.thinkingSessionId;
        result.warnings.push(...thinkingResult.warnings);
      }

      // Step 3: Generate development plan
      const plan = await this.generateDevelopmentPlan(planningSession, planParams);
      result.plan = plan;

      // Step 4: Validate plan completeness
      if (this.config.validateCompleteness) {
        const validation = await this.validatePlan(plan);
        
        if (!validation.isValid) {
          result.errors.push(...validation.errors);
          result.warnings.push(...validation.warnings);
          result.nextSteps.push(...validation.recommendations);
          return result;
        }
        
        result.warnings.push(...validation.warnings);
        result.nextSteps.push(...validation.recommendations);
      }

      // Step 5: Complete planning session
      await this.completePlanningSession(planningSession, plan);
      
      result.success = true;
      result.nextSteps.push('Plan created successfully');
      result.nextSteps.push('Use /approve_plan to approve and begin implementation');

    } catch (error) {
      result.errors.push(`Planning workflow failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Create planning session
   */
  private async createPlanningSession(
    orchestrationId: string,
    planParams: CreatePlanParams
  ): Promise<OrchestrationSession> {
    const sessionParams: CreateSessionParams = {
      type: SessionType.PLANNING,
      orchestrationId,
      initialFocus: `Planning: ${planParams.name}`,
      metadata: {
        name: `Planning Session for ${planParams.name}`,
        description: planParams.description,
        tags: ['planning', 'development'],
        userMetadata: {
          planName: planParams.name,
          planDescription: planParams.description,
        },
      },
    };

    return await this.sessionRegistry.createSession(sessionParams);
  }

  /**
   * Enforce mandatory thinking for planning
   */
  private async enforceMandatoryThinking(
    planningSession: OrchestrationSession,
    userInput: string
  ): Promise<{
    success: boolean;
    thinkingSessionId?: string;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      success: false,
      thinkingSessionId: undefined as string | undefined,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      // Check if thinking is already in progress
      const existingThinking = planningSession.context.sequentialThinking;
      
      if (existingThinking && existingThinking.state === 'active') {
        result.warnings.push('Thinking session already in progress');
        result.success = true;
        result.thinkingSessionId = existingThinking.id;
        return result;
      }

      // Start mandatory thinking session
      const thinkingSession = await this.thinkingIntegration.startThinkingForSession(
        planningSession.id,
        'planning_analysis',
        {
          userInput,
          mandatoryThinking: true,
          planningPhase: PlanningPhase.REQUIREMENTS_ANALYSIS,
        }
      );

      result.thinkingSessionId = thinkingSession.id;

      // Add initial thinking prompt to session
      planningSession.addMessage({
        role: 'user',
        parts: [{
          text: `Please analyze the following planning request using structured thinking. This is a mandatory thinking phase for planning operations.

Planning Request: ${userInput}

You must use the sequential thinking tool to:
1. Analyze requirements and constraints
2. Consider architectural approaches
3. Break down the work into manageable tasks
4. Identify risks and dependencies
5. Validate the overall approach

Begin your structured thinking now.`
        }]
      });

      // Wait for thinking to be completed (in a real implementation, this would be handled by the AI)
      // For now, we'll mark it as requiring completion
      result.warnings.push('Thinking session started - must be completed before proceeding');
      result.success = true;

    } catch (error) {
      result.errors.push(`Failed to start mandatory thinking: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Validate thinking completion before proceeding
   */
  async validateThinkingCompletion(sessionId: string): Promise<{
    isComplete: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const validation = await this.thinkingIntegration.validateThinkingSession(
      sessionId,
      'planning_analysis'
    );

    const result = {
      isComplete: validation.isComplete,
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
    };

    // Additional planning-specific validation
    if (validation.hasThinking && validation.isComplete) {
      const thinkingSummary = await this.thinkingIntegration.getThinkingSummary(sessionId);
      
      if (thinkingSummary.stepCount < this.config.minThinkingSteps) {
        result.warnings.push(`Thinking session has only ${thinkingSummary.stepCount} steps, consider more thorough analysis`);
      }

      // Check for required thinking elements
      const keyInsights = thinkingSummary.keyInsights.join(' ').toLowerCase();
      const requiredElements = ['requirement', 'task', 'architecture', 'risk'];
      const missingElements = requiredElements.filter(element => 
        !keyInsights.includes(element)
      );

      if (missingElements.length > 0) {
        result.warnings.push(`Thinking may be missing analysis of: ${missingElements.join(', ')}`);
      }
    }

    return result;
  }

  /**
   * Generate development plan from thinking session
   */
  private async generateDevelopmentPlan(
    planningSession: OrchestrationSession,
    planParams: CreatePlanParams
  ): Promise<DevelopmentPlan> {
    // Extract insights from thinking session
    const thinkingSession = planningSession.context.sequentialThinking;
    const thinkingInsights = thinkingSession ? 
      thinkingSession.steps.map(step => step.thought).join('\n') : '';

    // Create development plan
    const plan = await this.taskManifest.createPlan({
      name: planParams.name,
      description: planParams.description,
      requirements: planParams.requirements || this.extractRequirements(thinkingInsights),
      architectureDecisions: planParams.architectureDecisions || this.extractArchitectureDecisions(thinkingInsights),
      metadata: {
        ...planParams.metadata,
        thinkingSessionId: thinkingSession?.id,
        planningSessionId: planningSession.id,
        generatedFromThinking: true,
      },
    });

    // Add plan artifact to session
    planningSession.addArtifact({
      type: 'plan',
      name: plan.name,
      content: JSON.stringify(plan, null, 2),
      path: `plans/${plan.id}.json`,
    });

    return plan;
  }

  /**
   * Validate development plan
   */
  private async validatePlan(plan: DevelopmentPlan): Promise<PlanningValidationResult> {
    const result: PlanningValidationResult = {
      isValid: true,
      isComplete: true,
      errors: [],
      warnings: [],
      missingElements: [],
      recommendations: [],
    };

    // Check required elements
    if (!plan.name || plan.name.trim().length === 0) {
      result.errors.push('Plan name is required');
      result.isValid = false;
    }

    if (!plan.description || plan.description.trim().length === 0) {
      result.errors.push('Plan description is required');
      result.isValid = false;
    }

    if (plan.requirements.length === 0) {
      result.missingElements.push('requirements');
      result.warnings.push('Plan has no requirements defined');
    }

    if (plan.phases.length === 0) {
      result.missingElements.push('development phases');
      result.warnings.push('Plan has no development phases defined');
    }

    if (plan.tasks.length === 0) {
      result.missingElements.push('tasks');
      result.warnings.push('Plan has no tasks defined');
    }

    // Check plan completeness
    if (plan.risks.length === 0) {
      result.recommendations.push('Consider adding risk assessments');
    }

    if (plan.qualityGates.length === 0) {
      result.recommendations.push('Consider adding quality gates');
    }

    if (plan.architectureDecisions.length === 0) {
      result.recommendations.push('Consider documenting key architecture decisions');
    }

    // Validate estimation
    if (!plan.estimation || !plan.estimation.totalEffortHours) {
      result.recommendations.push('Consider adding effort estimation');
    }

    return result;
  }

  /**
   * Complete planning session
   */
  private async completePlanningSession(
    planningSession: OrchestrationSession,
    plan: DevelopmentPlan
  ): Promise<void> {
    // Add completion decision
    planningSession.addDecision({
      description: 'Planning phase completed',
      rationale: 'Development plan has been created and validated',
      outcome: 'Plan ready for approval and implementation',
      artifacts: [`plans/${plan.id}.json`],
    });

    // Update session state
    planningSession.updateState(SessionState.COMPLETED);
    planningSession.updateFocus('Planning completed - awaiting approval');

    // Complete thinking session if active
    if (planningSession.context.sequentialThinking?.state === 'active') {
      await this.thinkingIntegration.completeThinking(planningSession.id);
    }
  }

  /**
   * Extract requirements from thinking insights
   */
  private extractRequirements(thinkingInsights: string): Omit<Requirement, 'id'>[] {
    // Simplified requirement extraction
    // In a real implementation, this would use NLP or structured parsing
    const requirements: Omit<Requirement, 'id'>[] = [];
    
    if (thinkingInsights.toLowerCase().includes('user')) {
      requirements.push({
        title: 'User Interface Requirements',
        description: 'Requirements related to user interaction and interface design',
        type: 'functional',
        priority: 'medium' as any,
        status: 'identified' as any,
      });
    }

    if (thinkingInsights.toLowerCase().includes('data') || thinkingInsights.toLowerCase().includes('storage')) {
      requirements.push({
        title: 'Data Management Requirements',
        description: 'Requirements for data storage, processing, and management',
        type: 'functional',
        priority: 'high' as any,
        status: 'identified' as any,
      });
    }

    return requirements;
  }

  /**
   * Extract architecture decisions from thinking insights
   */
  private extractArchitectureDecisions(thinkingInsights: string): Omit<ArchitectureDecision, 'id'>[] {
    // Simplified architecture decision extraction
    const decisions: Omit<ArchitectureDecision, 'id'>[] = [];

    if (thinkingInsights.toLowerCase().includes('architecture') || thinkingInsights.toLowerCase().includes('design')) {
      decisions.push({
        title: 'System Architecture Approach',
        description: 'High-level architectural approach for the system',
        rationale: 'Based on requirements analysis and technical constraints',
        status: 'proposed' as any,
        date: new Date(),
      });
    }

    return decisions;
  }

  /**
   * Get planning workflow configuration
   */
  getConfig(): PlanningWorkflowConfig {
    return { ...this.config };
  }

  /**
   * Update planning workflow configuration
   */
  updateConfig(newConfig: Partial<PlanningWorkflowConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
