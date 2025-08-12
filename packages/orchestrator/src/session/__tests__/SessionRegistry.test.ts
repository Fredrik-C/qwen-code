/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionRegistry } from '../SessionRegistry.js';
import { StateManager } from '../../state/StateManager.js';
import { SessionType, SessionState } from '../../types/session.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SessionRegistry', () => {
  let sessionRegistry: SessionRegistry;
  let stateManager: StateManager;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orchestrator-test-'));
    
    stateManager = new StateManager({ baseDir: tempDir });
    await stateManager.initialize();
    
    sessionRegistry = new SessionRegistry(stateManager);
    await sessionRegistry.initialize();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const sessionParams = {
        type: SessionType.PLANNING,
        orchestrationId: 'test-orch-123',
        context: {
          currentFocus: 'Initial planning',
          nextSteps: ['Define requirements'],
          decisions: [],
        },
        metadata: {
          name: 'Test Planning Session',
          description: 'A test session for planning',
          tags: ['test', 'planning'],
        },
      };

      const session = await sessionRegistry.createSession(sessionParams);

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session-\d+-[a-zA-Z0-9]+$/);
      expect(session.type).toBe(SessionType.PLANNING);
      expect(session.state).toBe(SessionState.ACTIVE);
      expect(session.orchestrationId).toBe('test-orch-123');
      expect(session.context?.currentFocus).toBe('Initial planning');
      expect(session.metadata?.name).toBe('Test Planning Session');
    });

    it('should create session with parent relationship', async () => {
      // Create parent session
      const parentSession = await sessionRegistry.createSession({
        type: SessionType.PLANNING,
        orchestrationId: 'test-orch-123',
      });

      // Create child session
      const childSession = await sessionRegistry.createSession({
        type: SessionType.TASK,
        orchestrationId: 'test-orch-123',
        parentSessionId: parentSession.id,
      });

      expect(childSession.parentSessionId).toBe(parentSession.id);
      
      // Check that parent has child reference
      const updatedParent = await sessionRegistry.getSession(parentSession.id);
      expect(updatedParent?.childSessionIds).toContain(childSession.id);
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', async () => {
      const session = await sessionRegistry.createSession({
        type: SessionType.PLANNING,
        orchestrationId: 'test-orch-123',
      });

      const retrieved = await sessionRegistry.getSession(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
      expect(retrieved?.type).toBe(SessionType.PLANNING);
    });

    it('should return null for non-existent session', async () => {
      const retrieved = await sessionRegistry.getSession('non-existent-session');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update session properties', async () => {
      const session = await sessionRegistry.createSession({
        type: SessionType.PLANNING,
        orchestrationId: 'test-orch-123',
      });

      await sessionRegistry.updateSession(session.id, {
        state: SessionState.SUSPENDED,
        context: {
          currentFocus: 'Updated focus',
          nextSteps: ['Updated step'],
          decisions: [],
        },
      });

      const updated = await sessionRegistry.getSession(session.id);
      expect(updated?.state).toBe(SessionState.SUSPENDED);
      expect(updated?.context?.currentFocus).toBe('Updated focus');
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionRegistry.updateSession('non-existent', { state: SessionState.COMPLETED })
      ).rejects.toThrow();
    });
  });

  describe('querySessions', () => {
    beforeEach(async () => {
      // Create test sessions
      await sessionRegistry.createSession({
        type: SessionType.PLANNING,
        orchestrationId: 'orch-1',
      });
      
      await sessionRegistry.createSession({
        type: SessionType.TASK,
        orchestrationId: 'orch-1',
      });
      
      await sessionRegistry.createSession({
        type: SessionType.PLANNING,
        orchestrationId: 'orch-2',
      });
    });

    it('should query sessions by orchestration ID', async () => {
      const sessions = await sessionRegistry.querySessions({ orchestrationId: 'orch-1' });
      expect(sessions).toHaveLength(2);
      expect(sessions.every(s => s.orchestrationId === 'orch-1')).toBe(true);
    });

    it('should query sessions by type', async () => {
      const sessions = await sessionRegistry.querySessions({ type: SessionType.PLANNING });
      expect(sessions).toHaveLength(2);
      expect(sessions.every(s => s.type === SessionType.PLANNING)).toBe(true);
    });

    it('should query sessions by state', async () => {
      const sessions = await sessionRegistry.querySessions({ state: SessionState.ACTIVE });
      expect(sessions).toHaveLength(3);
      expect(sessions.every(s => s.state === SessionState.ACTIVE)).toBe(true);
    });

    it('should query with multiple filters', async () => {
      const sessions = await sessionRegistry.querySessions({
        orchestrationId: 'orch-1',
        type: SessionType.PLANNING,
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].orchestrationId).toBe('orch-1');
      expect(sessions[0].type).toBe(SessionType.PLANNING);
    });
  });

  describe('cleanupSessions', () => {
    it('should remove completed and failed sessions', async () => {
      // Create sessions with different states
      const activeSession = await sessionRegistry.createSession({
        type: SessionType.PLANNING,
        orchestrationId: 'test-orch',
      });

      const completedSession = await sessionRegistry.createSession({
        type: SessionType.TASK,
        orchestrationId: 'test-orch',
      });

      const failedSession = await sessionRegistry.createSession({
        type: SessionType.VERIFICATION,
        orchestrationId: 'test-orch',
      });

      // Update states
      await sessionRegistry.updateSession(completedSession.id, { state: SessionState.COMPLETED });
      await sessionRegistry.updateSession(failedSession.id, { state: SessionState.FAILED });

      // Cleanup
      const result = await sessionRegistry.cleanupSessions();

      expect(result.removedCount).toBe(2);
      expect(result.remainingCount).toBe(1);

      // Verify active session still exists
      const remaining = await sessionRegistry.getSession(activeSession.id);
      expect(remaining).toBeDefined();

      // Verify completed and failed sessions are removed
      const completedRemaining = await sessionRegistry.getSession(completedSession.id);
      const failedRemaining = await sessionRegistry.getSession(failedSession.id);
      expect(completedRemaining).toBeNull();
      expect(failedRemaining).toBeNull();
    });
  });

  describe('getSessionNavigationHistory', () => {
    it('should return timeline and hierarchy', async () => {
      const orchestrationId = 'test-orch-nav';
      
      // Create parent session
      const parentSession = await sessionRegistry.createSession({
        type: SessionType.PLANNING,
        orchestrationId,
        context: { currentFocus: 'Planning' },
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create child session
      const childSession = await sessionRegistry.createSession({
        type: SessionType.TASK,
        orchestrationId,
        parentSessionId: parentSession.id,
        context: { currentFocus: 'Implementation' },
      });

      const history = await sessionRegistry.getSessionNavigationHistory(orchestrationId);

      expect(history.timeline).toHaveLength(2);
      expect(history.hierarchy).toHaveLength(2);

      // Check timeline is sorted by start time
      expect(history.timeline[0].sessionId).toBe(parentSession.id);
      expect(history.timeline[1].sessionId).toBe(childSession.id);

      // Check hierarchy includes parent-child relationship
      const parentHierarchy = history.hierarchy.find(h => h.sessionId === parentSession.id);
      expect(parentHierarchy?.children).toContain(childSession.id);
    });
  });

  describe('findRelatedSessions', () => {
    it('should find parent, children, and siblings', async () => {
      const orchestrationId = 'test-orch-related';
      
      // Create parent session
      const parentSession = await sessionRegistry.createSession({
        type: SessionType.PLANNING,
        orchestrationId,
      });

      // Create child sessions
      const child1 = await sessionRegistry.createSession({
        type: SessionType.TASK,
        orchestrationId,
        parentSessionId: parentSession.id,
      });

      const child2 = await sessionRegistry.createSession({
        type: SessionType.TASK,
        orchestrationId,
        parentSessionId: parentSession.id,
      });

      const related = await sessionRegistry.findRelatedSessions(child1.id);

      expect(related.parent?.id).toBe(parentSession.id);
      expect(related.children).toHaveLength(0); // child1 has no children
      expect(related.siblings).toHaveLength(1);
      expect(related.siblings[0].id).toBe(child2.id);
    });
  });

  describe('getSessionBreadcrumbs', () => {
    it('should return breadcrumb trail from root to session', async () => {
      const orchestrationId = 'test-orch-breadcrumbs';
      
      // Create session hierarchy: grandparent -> parent -> child
      const grandparent = await sessionRegistry.createSession({
        type: SessionType.PLANNING,
        orchestrationId,
        metadata: { name: 'Grandparent Session' },
        context: { currentFocus: 'High-level planning' },
      });

      const parent = await sessionRegistry.createSession({
        type: SessionType.TASK,
        orchestrationId,
        parentSessionId: grandparent.id,
        metadata: { name: 'Parent Session' },
        context: { currentFocus: 'Detailed planning' },
      });

      const child = await sessionRegistry.createSession({
        type: SessionType.TASK,
        orchestrationId,
        parentSessionId: parent.id,
        metadata: { name: 'Child Session' },
        context: { currentFocus: 'Implementation' },
      });

      const breadcrumbs = await sessionRegistry.getSessionBreadcrumbs(child.id);

      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[0].sessionId).toBe(grandparent.id);
      expect(breadcrumbs[0].name).toBe('Grandparent Session');
      expect(breadcrumbs[1].sessionId).toBe(parent.id);
      expect(breadcrumbs[1].name).toBe('Parent Session');
      expect(breadcrumbs[2].sessionId).toBe(child.id);
      expect(breadcrumbs[2].name).toBe('Child Session');
    });
  });
});
