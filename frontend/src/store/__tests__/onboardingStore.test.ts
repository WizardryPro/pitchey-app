import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';

// Mock zustand persist so it doesn't hit localStorage in tests
vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');
  return {
    ...actual,
    persist: (fn: any) => fn,
  };
});

import { useOnboardingStore } from '../onboardingStore';

// Helper: reset all relevant onboarding state before each test
function resetStore() {
  useOnboardingStore.setState({
    currentFlow: null,
    isOnboardingActive: false,
    canSkipOnboarding: true,
    activeTutorial: null,
    tutorialSteps: [],
    currentTutorialStep: 0,
    tutorialHistory: [],
    totalPoints: 0,
    level: 1,
    streakDays: 0,
    lastActivityDate: undefined,
    discoveredFeatures: [],
    pendingFeaturePrompts: [],
    featureSpotlightQueue: [],
    preferences: {
      showTooltips: true,
      enableGamification: true,
      autoplayTutorials: false,
      skipAnimations: false,
      reminderFrequency: 'weekly',
    },
    analytics: {
      stepCompletionTimes: {},
      tutorialDropoffPoints: {},
      featureEngagement: {},
      helpRequestCount: 0,
    },
  });
  // Also reset achievements (all unlockedAt removed)
  useOnboardingStore.getState().resetAchievements();
  // Re-run reset to restore flows as well
  useOnboardingStore.getState().resetOnboarding();
}

describe('onboardingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  // =========================================================================
  // Initial state
  // =========================================================================
  describe('initial state', () => {
    it('has no current flow', () => {
      expect(useOnboardingStore.getState().currentFlow).toBeNull();
    });

    it('is not active', () => {
      expect(useOnboardingStore.getState().isOnboardingActive).toBe(false);
    });

    it('can skip onboarding', () => {
      expect(useOnboardingStore.getState().canSkipOnboarding).toBe(true);
    });

    it('has zero points', () => {
      expect(useOnboardingStore.getState().totalPoints).toBe(0);
    });

    it('starts at level 1', () => {
      expect(useOnboardingStore.getState().level).toBe(1);
    });

    it('has three default flows', () => {
      const flows = useOnboardingStore.getState().flows;
      expect(Object.keys(flows)).toHaveLength(3);
      expect(flows['creator-onboarding']).toBeDefined();
      expect(flows['investor-onboarding']).toBeDefined();
      expect(flows['production-onboarding']).toBeDefined();
    });

    it('has default preferences', () => {
      const prefs = useOnboardingStore.getState().preferences;
      expect(prefs.showTooltips).toBe(true);
      expect(prefs.enableGamification).toBe(true);
      expect(prefs.reminderFrequency).toBe('weekly');
    });

    it('has 7 default achievements', () => {
      const achievements = useOnboardingStore.getState().achievements;
      expect(achievements.length).toBe(7);
    });

    it('has no active tutorial', () => {
      expect(useOnboardingStore.getState().activeTutorial).toBeNull();
    });
  });

  // =========================================================================
  // initializeOnboarding
  // =========================================================================
  describe('initializeOnboarding', () => {
    it('sets currentFlow for creator', () => {
      act(() => {
        useOnboardingStore.getState().initializeOnboarding('creator');
      });
      const flow = useOnboardingStore.getState().currentFlow;
      expect(flow).not.toBeNull();
      expect(flow?.userType).toBe('creator');
      expect(flow?.id).toBe('creator-onboarding');
    });

    it('sets isOnboardingActive to true', () => {
      act(() => {
        useOnboardingStore.getState().initializeOnboarding('investor');
      });
      expect(useOnboardingStore.getState().isOnboardingActive).toBe(true);
    });

    it('sets startedAt on the flow', () => {
      act(() => {
        useOnboardingStore.getState().initializeOnboarding('production');
      });
      expect(useOnboardingStore.getState().currentFlow?.startedAt).toBeInstanceOf(Date);
    });

    it('works for all three user types', () => {
      const types = ['creator', 'investor', 'production'] as const;
      types.forEach(type => {
        act(() => {
          useOnboardingStore.getState().initializeOnboarding(type);
        });
        expect(useOnboardingStore.getState().currentFlow?.userType).toBe(type);
      });
    });
  });

  // =========================================================================
  // startFlow
  // =========================================================================
  describe('startFlow', () => {
    it('starts a flow by id', () => {
      act(() => {
        useOnboardingStore.getState().startFlow('investor-onboarding');
      });
      const flow = useOnboardingStore.getState().currentFlow;
      expect(flow?.id).toBe('investor-onboarding');
      expect(useOnboardingStore.getState().isOnboardingActive).toBe(true);
    });

    it('does nothing for unknown flow id', () => {
      act(() => {
        useOnboardingStore.getState().startFlow('nonexistent-flow');
      });
      expect(useOnboardingStore.getState().currentFlow).toBeNull();
      expect(useOnboardingStore.getState().isOnboardingActive).toBe(false);
    });
  });

  // =========================================================================
  // completeStep
  // =========================================================================
  describe('completeStep', () => {
    beforeEach(() => {
      act(() => {
        useOnboardingStore.getState().initializeOnboarding('creator');
      });
    });

    it('marks a step as completed', () => {
      act(() => {
        useOnboardingStore.getState().completeStep('welcome');
      });
      const step = useOnboardingStore.getState().currentFlow?.steps.find(s => s.id === 'welcome');
      expect(step?.completed).toBe(true);
      expect(step?.progress).toBe(100);
    });

    it('advances currentStepIndex', () => {
      act(() => {
        useOnboardingStore.getState().completeStep('welcome');
      });
      // welcome is index 0, so currentStepIndex should advance to 1
      expect(useOnboardingStore.getState().currentFlow?.currentStepIndex).toBe(1);
    });

    it('does nothing when no currentFlow', () => {
      act(() => {
        useOnboardingStore.setState({ currentFlow: null });
        useOnboardingStore.getState().completeStep('welcome');
      });
      expect(useOnboardingStore.getState().currentFlow).toBeNull();
    });

    it('does nothing for unknown step id', () => {
      act(() => {
        useOnboardingStore.getState().completeStep('nonexistent-step');
      });
      // currentStepIndex stays at 0
      expect(useOnboardingStore.getState().currentFlow?.currentStepIndex).toBe(0);
    });

    it('marks flow completed when all required steps are done', () => {
      act(() => {
        useOnboardingStore.getState().completeStep('profile-setup');
        useOnboardingStore.getState().completeStep('first-pitch');
      });
      expect(useOnboardingStore.getState().currentFlow?.completed).toBe(true);
      expect(useOnboardingStore.getState().currentFlow?.completedAt).toBeInstanceOf(Date);
    });

    it('unlocks first-pitch achievement when completing first-pitch step', () => {
      act(() => {
        useOnboardingStore.getState().completeStep('first-pitch');
      });
      const ach = useOnboardingStore.getState().achievements.find(a => a.id === 'first-pitch');
      expect(ach?.unlockedAt).toBeInstanceOf(Date);
    });
  });

  // =========================================================================
  // skipStep
  // =========================================================================
  describe('skipStep', () => {
    beforeEach(() => {
      act(() => {
        useOnboardingStore.getState().initializeOnboarding('creator');
      });
    });

    it('marks an optional step as skipped', () => {
      act(() => {
        useOnboardingStore.getState().skipStep('welcome'); // welcome is required:false
      });
      const step = useOnboardingStore.getState().currentFlow?.steps.find(s => s.id === 'welcome');
      expect(step?.skipped).toBe(true);
    });

    it('adds step to skippedSteps array', () => {
      act(() => {
        useOnboardingStore.getState().skipStep('welcome');
      });
      expect(useOnboardingStore.getState().currentFlow?.skippedSteps).toContain('welcome');
    });

    it('cannot skip a required step', () => {
      act(() => {
        useOnboardingStore.getState().skipStep('profile-setup'); // required: true
      });
      const step = useOnboardingStore.getState().currentFlow?.steps.find(s => s.id === 'profile-setup');
      expect(step?.skipped).toBeUndefined();
    });

    it('does nothing when no currentFlow', () => {
      act(() => {
        useOnboardingStore.setState({ currentFlow: null });
        useOnboardingStore.getState().skipStep('welcome');
      });
      expect(useOnboardingStore.getState().currentFlow).toBeNull();
    });
  });

  // =========================================================================
  // nextStep / previousStep
  // =========================================================================
  describe('nextStep / previousStep', () => {
    beforeEach(() => {
      act(() => {
        useOnboardingStore.getState().initializeOnboarding('creator');
      });
    });

    it('nextStep increments currentStepIndex', () => {
      act(() => {
        useOnboardingStore.getState().nextStep();
      });
      expect(useOnboardingStore.getState().currentFlow?.currentStepIndex).toBe(1);
    });

    it('nextStep does not go past last step', () => {
      // Move to last step manually
      const steps = useOnboardingStore.getState().currentFlow!.steps;
      act(() => {
        useOnboardingStore.setState({
          currentFlow: {
            ...useOnboardingStore.getState().currentFlow!,
            currentStepIndex: steps.length - 1
          }
        });
        useOnboardingStore.getState().nextStep();
      });
      expect(useOnboardingStore.getState().currentFlow?.currentStepIndex).toBe(steps.length - 1);
    });

    it('previousStep decrements currentStepIndex', () => {
      act(() => {
        useOnboardingStore.getState().nextStep();
        useOnboardingStore.getState().previousStep();
      });
      expect(useOnboardingStore.getState().currentFlow?.currentStepIndex).toBe(0);
    });

    it('previousStep does not go below 0', () => {
      act(() => {
        useOnboardingStore.getState().previousStep();
      });
      expect(useOnboardingStore.getState().currentFlow?.currentStepIndex).toBe(0);
    });

    it('nextStep does nothing when no currentFlow', () => {
      act(() => {
        useOnboardingStore.setState({ currentFlow: null });
        useOnboardingStore.getState().nextStep();
      });
      expect(useOnboardingStore.getState().currentFlow).toBeNull();
    });
  });

  // =========================================================================
  // skipOnboarding / completeOnboarding
  // =========================================================================
  describe('skipOnboarding', () => {
    it('sets isOnboardingActive to false and clears currentFlow', () => {
      act(() => {
        useOnboardingStore.getState().initializeOnboarding('creator');
        useOnboardingStore.getState().skipOnboarding();
      });
      expect(useOnboardingStore.getState().isOnboardingActive).toBe(false);
      expect(useOnboardingStore.getState().currentFlow).toBeNull();
    });
  });

  describe('completeOnboarding', () => {
    it('marks flow completed and deactivates', () => {
      act(() => {
        useOnboardingStore.getState().initializeOnboarding('creator');
        useOnboardingStore.getState().completeOnboarding();
      });
      const state = useOnboardingStore.getState();
      expect(state.isOnboardingActive).toBe(false);
      expect(state.currentFlow?.completed).toBe(true);
    });

    it('adds 150 points when completing onboarding', () => {
      act(() => {
        useOnboardingStore.getState().initializeOnboarding('creator');
        useOnboardingStore.getState().completeOnboarding();
      });
      // 150 points from addPoints + possible achievement points
      expect(useOnboardingStore.getState().totalPoints).toBeGreaterThanOrEqual(150);
    });

    it('does nothing when no currentFlow', () => {
      act(() => {
        useOnboardingStore.getState().completeOnboarding();
      });
      expect(useOnboardingStore.getState().isOnboardingActive).toBe(false);
    });
  });

  // =========================================================================
  // Tutorial actions
  // =========================================================================
  describe('tutorial actions', () => {
    const mockSteps = [
      { id: 'step-1', target: '#el1', title: 'Step 1', content: 'Content 1' },
      { id: 'step-2', target: '#el2', title: 'Step 2', content: 'Content 2' },
      { id: 'step-3', target: '#el3', title: 'Step 3', content: 'Content 3' },
    ];

    it('startTutorial sets activeTutorial and steps', () => {
      act(() => {
        useOnboardingStore.getState().startTutorial('my-tutorial', mockSteps);
      });
      expect(useOnboardingStore.getState().activeTutorial).toBe('my-tutorial');
      expect(useOnboardingStore.getState().tutorialSteps).toHaveLength(3);
      expect(useOnboardingStore.getState().currentTutorialStep).toBe(0);
    });

    it('startTutorial adds to tutorialHistory', () => {
      act(() => {
        useOnboardingStore.getState().startTutorial('tutorial-a', mockSteps);
      });
      expect(useOnboardingStore.getState().tutorialHistory).toContain('tutorial-a');
    });

    it('nextTutorialStep advances step', () => {
      act(() => {
        useOnboardingStore.getState().startTutorial('t1', mockSteps);
        useOnboardingStore.getState().nextTutorialStep();
      });
      expect(useOnboardingStore.getState().currentTutorialStep).toBe(1);
    });

    it('nextTutorialStep does not go past last step', () => {
      act(() => {
        useOnboardingStore.getState().startTutorial('t1', mockSteps);
        useOnboardingStore.getState().nextTutorialStep();
        useOnboardingStore.getState().nextTutorialStep();
        useOnboardingStore.getState().nextTutorialStep(); // should stop at 2
      });
      expect(useOnboardingStore.getState().currentTutorialStep).toBe(2);
    });

    it('previousTutorialStep decrements step', () => {
      act(() => {
        useOnboardingStore.getState().startTutorial('t1', mockSteps);
        useOnboardingStore.getState().nextTutorialStep();
        useOnboardingStore.getState().previousTutorialStep();
      });
      expect(useOnboardingStore.getState().currentTutorialStep).toBe(0);
    });

    it('previousTutorialStep does not go below 0', () => {
      act(() => {
        useOnboardingStore.getState().startTutorial('t1', mockSteps);
        useOnboardingStore.getState().previousTutorialStep();
      });
      expect(useOnboardingStore.getState().currentTutorialStep).toBe(0);
    });

    it('completeTutorial clears active tutorial and awards 25 points', () => {
      act(() => {
        useOnboardingStore.getState().startTutorial('t1', mockSteps);
        useOnboardingStore.getState().completeTutorial();
      });
      expect(useOnboardingStore.getState().activeTutorial).toBeNull();
      expect(useOnboardingStore.getState().tutorialSteps).toHaveLength(0);
      expect(useOnboardingStore.getState().totalPoints).toBeGreaterThanOrEqual(25);
    });

    it('completeTutorial unlocks tutorial-master after 5 tutorials', () => {
      act(() => {
        // We need 5 completed tutorials in history
        // Start + complete 5 tutorials
        for (let i = 0; i < 5; i++) {
          useOnboardingStore.getState().startTutorial(`tutorial-${i}`, mockSteps);
          useOnboardingStore.getState().completeTutorial();
        }
      });
      const ach = useOnboardingStore.getState().achievements.find(a => a.id === 'tutorial-master');
      expect(ach?.unlockedAt).toBeInstanceOf(Date);
    });

    it('skipTutorial clears tutorial and tracks dropoff', () => {
      act(() => {
        useOnboardingStore.getState().startTutorial('t1', mockSteps);
        useOnboardingStore.getState().nextTutorialStep();
        useOnboardingStore.getState().skipTutorial();
      });
      expect(useOnboardingStore.getState().activeTutorial).toBeNull();
      // Dropoff should be recorded
      const analytics = useOnboardingStore.getState().analytics;
      expect(analytics.tutorialDropoffPoints['t1-1']).toBe(1);
    });
  });

  // =========================================================================
  // Achievement actions
  // =========================================================================
  describe('achievement actions', () => {
    it('unlockAchievement sets unlockedAt', () => {
      act(() => {
        useOnboardingStore.getState().unlockAchievement('first-login');
      });
      const ach = useOnboardingStore.getState().achievements.find(a => a.id === 'first-login');
      expect(ach?.unlockedAt).toBeInstanceOf(Date);
    });

    it('unlockAchievement does not re-unlock already unlocked achievement', () => {
      act(() => {
        useOnboardingStore.getState().unlockAchievement('first-login');
      });
      const firstUnlock = useOnboardingStore.getState().achievements.find(a => a.id === 'first-login')?.unlockedAt;

      act(() => {
        useOnboardingStore.getState().unlockAchievement('first-login');
      });
      const secondUnlock = useOnboardingStore.getState().achievements.find(a => a.id === 'first-login')?.unlockedAt;
      expect(firstUnlock).toEqual(secondUnlock);
    });

    it('unlockAchievement adds points', () => {
      act(() => {
        useOnboardingStore.getState().unlockAchievement('first-login'); // 10 points
      });
      expect(useOnboardingStore.getState().totalPoints).toBe(10);
    });

    it('unlockAchievement for unknown id does nothing', () => {
      act(() => {
        useOnboardingStore.getState().unlockAchievement('nonexistent-achievement');
      });
      expect(useOnboardingStore.getState().totalPoints).toBe(0);
    });
  });

  // =========================================================================
  // Points and level
  // =========================================================================
  describe('addPoints / updateLevel', () => {
    it('addPoints increases totalPoints', () => {
      act(() => {
        useOnboardingStore.getState().addPoints(50);
      });
      expect(useOnboardingStore.getState().totalPoints).toBe(50);
    });

    it('addPoints calls updateLevel which adjusts level', () => {
      act(() => {
        useOnboardingStore.getState().addPoints(200);
      });
      // Level = floor(200/100) + 1 = 3
      expect(useOnboardingStore.getState().level).toBe(3);
    });

    it('level stays at 1 below 100 points', () => {
      act(() => {
        useOnboardingStore.getState().addPoints(99);
      });
      expect(useOnboardingStore.getState().level).toBe(1);
    });

    it('level becomes 2 at exactly 100 points', () => {
      act(() => {
        useOnboardingStore.getState().addPoints(100);
      });
      expect(useOnboardingStore.getState().level).toBe(2);
    });
  });

  // =========================================================================
  // updateStreak
  // =========================================================================
  describe('updateStreak', () => {
    it('starts streak at 1 with no prior activity', () => {
      act(() => {
        useOnboardingStore.getState().updateStreak();
      });
      expect(useOnboardingStore.getState().streakDays).toBe(1);
      expect(useOnboardingStore.getState().lastActivityDate).toBeInstanceOf(Date);
    });

    it('does not change streak when called on same day', () => {
      act(() => {
        useOnboardingStore.getState().updateStreak();
        useOnboardingStore.getState().updateStreak();
      });
      expect(useOnboardingStore.getState().streakDays).toBe(1);
    });

    it('resets streak when more than 1 day has passed', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      act(() => {
        useOnboardingStore.setState({ lastActivityDate: threeDaysAgo, streakDays: 5 });
        useOnboardingStore.getState().updateStreak();
      });
      expect(useOnboardingStore.getState().streakDays).toBe(1);
    });

    it('unlocks week-streak achievement at 7 consecutive days', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      act(() => {
        useOnboardingStore.setState({ lastActivityDate: yesterday, streakDays: 6 });
        useOnboardingStore.getState().updateStreak();
      });
      expect(useOnboardingStore.getState().streakDays).toBe(7);
      const ach = useOnboardingStore.getState().achievements.find(a => a.id === 'week-streak');
      expect(ach?.unlockedAt).toBeInstanceOf(Date);
    });
  });

  // =========================================================================
  // Feature discovery
  // =========================================================================
  describe('feature discovery', () => {
    it('markFeatureDiscovered adds feature', () => {
      act(() => {
        useOnboardingStore.getState().markFeatureDiscovered('dark-mode');
      });
      expect(useOnboardingStore.getState().discoveredFeatures).toContain('dark-mode');
    });

    it('markFeatureDiscovered does not duplicate', () => {
      act(() => {
        useOnboardingStore.getState().markFeatureDiscovered('dark-mode');
        useOnboardingStore.getState().markFeatureDiscovered('dark-mode');
      });
      const count = useOnboardingStore.getState().discoveredFeatures.filter(f => f === 'dark-mode').length;
      expect(count).toBe(1);
    });

    it('markFeatureDiscovered tracks engagement', () => {
      act(() => {
        useOnboardingStore.getState().markFeatureDiscovered('search');
      });
      expect(useOnboardingStore.getState().analytics.featureEngagement['search']).toBe(1);
    });

    it('addFeaturePrompt adds prompt', () => {
      act(() => {
        useOnboardingStore.getState().addFeaturePrompt('export');
      });
      expect(useOnboardingStore.getState().pendingFeaturePrompts).toContain('export');
    });

    it('addFeaturePrompt does not duplicate', () => {
      act(() => {
        useOnboardingStore.getState().addFeaturePrompt('export');
        useOnboardingStore.getState().addFeaturePrompt('export');
      });
      const count = useOnboardingStore.getState().pendingFeaturePrompts.filter(p => p === 'export').length;
      expect(count).toBe(1);
    });

    it('dismissFeaturePrompt removes prompt', () => {
      act(() => {
        useOnboardingStore.getState().addFeaturePrompt('export');
        useOnboardingStore.getState().dismissFeaturePrompt('export');
      });
      expect(useOnboardingStore.getState().pendingFeaturePrompts).not.toContain('export');
    });
  });

  // =========================================================================
  // Preferences
  // =========================================================================
  describe('updatePreferences', () => {
    it('merges partial preference updates', () => {
      act(() => {
        useOnboardingStore.getState().updatePreferences({ showTooltips: false });
      });
      expect(useOnboardingStore.getState().preferences.showTooltips).toBe(false);
      // Other prefs unchanged
      expect(useOnboardingStore.getState().preferences.enableGamification).toBe(true);
    });

    it('updates reminderFrequency', () => {
      act(() => {
        useOnboardingStore.getState().updatePreferences({ reminderFrequency: 'never' });
      });
      expect(useOnboardingStore.getState().preferences.reminderFrequency).toBe('never');
    });
  });

  // =========================================================================
  // Analytics
  // =========================================================================
  describe('analytics actions', () => {
    it('trackStepCompletion records time', () => {
      act(() => {
        useOnboardingStore.getState().trackStepCompletion('welcome', 12345);
      });
      expect(useOnboardingStore.getState().analytics.stepCompletionTimes['welcome']).toBe(12345);
    });

    it('trackTutorialDropoff increments count', () => {
      act(() => {
        useOnboardingStore.getState().trackTutorialDropoff('my-tutorial', 2);
        useOnboardingStore.getState().trackTutorialDropoff('my-tutorial', 2);
      });
      expect(useOnboardingStore.getState().analytics.tutorialDropoffPoints['my-tutorial-2']).toBe(2);
    });

    it('trackFeatureEngagement increments count', () => {
      act(() => {
        useOnboardingStore.getState().trackFeatureEngagement('pitch-editor');
        useOnboardingStore.getState().trackFeatureEngagement('pitch-editor');
      });
      expect(useOnboardingStore.getState().analytics.featureEngagement['pitch-editor']).toBe(2);
    });

    it('incrementHelpRequests increments count', () => {
      act(() => {
        useOnboardingStore.getState().incrementHelpRequests();
        useOnboardingStore.getState().incrementHelpRequests();
      });
      expect(useOnboardingStore.getState().analytics.helpRequestCount).toBe(2);
    });
  });

  // =========================================================================
  // Reset actions
  // =========================================================================
  describe('reset actions', () => {
    it('resetOnboarding clears currentFlow and resets flows', () => {
      act(() => {
        useOnboardingStore.getState().initializeOnboarding('creator');
        useOnboardingStore.getState().resetOnboarding();
      });
      expect(useOnboardingStore.getState().currentFlow).toBeNull();
      expect(useOnboardingStore.getState().isOnboardingActive).toBe(false);
      expect(Object.keys(useOnboardingStore.getState().flows)).toHaveLength(3);
    });

    it('resetAchievements clears unlocked state and points', () => {
      act(() => {
        useOnboardingStore.getState().unlockAchievement('first-login');
        useOnboardingStore.getState().resetAchievements();
      });
      const ach = useOnboardingStore.getState().achievements.find(a => a.id === 'first-login');
      expect(ach?.unlockedAt).toBeUndefined();
      expect(useOnboardingStore.getState().totalPoints).toBe(0);
      expect(useOnboardingStore.getState().level).toBe(1);
      expect(useOnboardingStore.getState().streakDays).toBe(0);
    });
  });
});
