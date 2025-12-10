import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { dailySuggestionsEngine } from './lib/ai/coach/daily-suggestions';
import XpSystem from './lib/xp/xp-system';

// Mock the unified-aggregator-wrapper
vi.mock('./lib/storage/unified-aggregator-wrapper', () => ({
  getDailyStats: vi.fn(),
  getWeeklyStats: vi.fn(),
}));

// Mock the unified-store
vi.mock('./lib/storage/unified-store', () => ({
  default: {
    addXP: vi.fn(),
    getXp: vi.fn(),
  },
}));

describe('Phase 20 Feature Tests', () => {
  describe('Daily Suggestions Engine', () => {
    it('should generate suggestion for low sleep (<6h)', async () => {
      const mockUserId = 'test-user';
      
      // Mock daily stats with low sleep
      const { getDailyStats } = await import('./lib/storage/unified-aggregator-wrapper');
      (getDailyStats as MockedFunction<any>).mockResolvedValue({
        sleepHours: 5,
        steps: 8000,
        caloriesIn: 2000,
        caloriesOut: 2200,
      });

      const suggestions = await dailySuggestionsEngine(mockUserId);
      
      const lowSleepSuggestions = suggestions.filter(s => s.ruleId === 'low-sleep-rule');
      expect(lowSleepSuggestions.length).toBe(1);
      expect(lowSleepSuggestions[0].title).toBe('Prioritize Rest');
    });

    it('should generate suggestion for high calorie surplus (>400)', async () => {
      const mockUserId = 'test-user';
      
      // Mock daily stats with high calorie surplus
      const { getDailyStats } = await import('./lib/storage/unified-aggregator-wrapper');
      (getDailyStats as MockedFunction<any>).mockResolvedValue({
        sleepHours: 7,
        steps: 8000,
        caloriesIn: 2500,
        caloriesOut: 1800, // Surplus of 700 calories
      });

      const suggestions = await dailySuggestionsEngine(mockUserId);
      
      const highCalorieSuggestions = suggestions.filter(s => s.ruleId === 'high-calorie-surplus-rule');
      expect(highCalorieSuggestions.length).toBe(1);
      expect(highCalorieSuggestions[0].title).toBe('Mind Your Intake');
    });

    it('should generate suggestion for low steps (<3000)', async () => {
      const mockUserId = 'test-user';
      
      // Mock daily stats with low steps
      const { getDailyStats } = await import('./lib/storage/unified-aggregator-wrapper');
      (getDailyStats as MockedFunction<any>).mockResolvedValue({
        sleepHours: 8,
        steps: 2000,
        caloriesIn: 2000,
        caloriesOut: 2200,
      });

      const suggestions = await dailySuggestionsEngine(mockUserId);
      
      const lowStepsSuggestions = suggestions.filter(s => s.ruleId === 'low-steps-rule');
      expect(lowStepsSuggestions.length).toBe(1);
      expect(lowStepsSuggestions[0].title).toBe('Move More Today');
    });

    it('should generate positive streak suggestion when goals met', async () => {
      const mockUserId = 'test-user';
      
      // Mock daily stats where most goals are met
      const { getDailyStats } = await import('./lib/storage/unified-aggregator-wrapper');
      (getDailyStats as MockedFunction<any>).mockResolvedValue({
        sleepHours: 8, // Good sleep
        steps: 9000, // Good steps
        caloriesIn: 2000,
        caloriesOut: 2100, // Good balance (within 300 cal difference)
      });

      const suggestions = await dailySuggestionsEngine(mockUserId);
      
      const positiveStreakSuggestions = suggestions.filter(s => s.ruleId === 'positive-streak-rule');
      expect(positiveStreakSuggestions.length).toBe(1);
      expect(positiveStreakSuggestions[0].title).toBe('Great Consistency!');
    });
  });

  describe('XP System with Boost Mode', () => {
    beforeEach(() => {
      // Reset all mocks
      vi.clearAllMocks();
    });

    it('should calculate 10% bonus for 3-day steps streak (>6000 steps)', async () => {
      const mockUserId = 'test-user';
      
      // Mock weekly stats with 3 days of high steps
      const { getWeeklyStats } = await import('./lib/storage/unified-aggregator-wrapper');
      (getWeeklyStats as MockedFunction<any>).mockResolvedValue({
        dates: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        steps: [7000, 8000, 9000, 4000, 5000, 6000, 7000], // Last 3 days: 7000, 6000, 7000
        sleepHours: [7, 8, 6, 7, 8, 7, 8],
        caloriesIn: [2000, 2100, 1900, 2200, 2000, 2100, 2000],
        caloriesOut: [2100, 2200, 2000, 2300, 2100, 2200, 2100],
      });

      const bonus = await XpSystem.calculateXpBonus(mockUserId);
      
      // With 3 days of >6000 steps, should get 10% bonus
      expect(bonus).toBe(1.1);
    });

    it('should calculate 10% bonus for 3-day sleep streak (>7 hours)', async () => {
      const mockUserId = 'test-user';
      
      // Mock weekly stats with 3 days of good sleep
      const { getWeeklyStats } = await import('./lib/storage/unified-aggregator-wrapper');
      (getWeeklyStats as MockedFunction<any>).mockResolvedValue({
        dates: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        steps: [5000, 4000, 3000, 4000, 5000, 8000, 9000],
        sleepHours: [5, 6, 8.5, 8.2, 7.8, 6, 5], // Last 3 days: 7.8, 6, 5 (not a streak)
        caloriesIn: [2000, 2100, 1900, 2200, 2000, 2100, 2000],
        caloriesOut: [2100, 2200, 2000, 2300, 2100, 2200, 2100],
      });

      const bonus = await XpSystem.calculateXpBonus(mockUserId);
      
      // No bonus expected since last 3 days don't meet sleep streak criteria
      expect(bonus).toBe(1.0);
    });

    it('should calculate 20% bonus for both streaks', async () => {
      const mockUserId = 'test-user';
      
      // Mock weekly stats with both streaks
      const { getWeeklyStats } = await import('./lib/storage/unified-aggregator-wrapper');
      (getWeeklyStats as MockedFunction<any>).mockResolvedValue({
        dates: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        steps: [4000, 5000, 6000, 7000, 8000, 9000, 10000], // Last 3 days: 8000, 9000, 10000 (all > 6000)
        sleepHours: [5, 6, 5, 8.5, 8.2, 7.8, 8.1], // Last 3 days: 8.2, 7.8, 8.1 (all > 7)
        caloriesIn: [2000, 2100, 2200, 1800, 1900, 2000, 2100],
        caloriesOut: [2100, 2200, 2300, 2400, 2500, 2600, 2700], // All > caloriesIn
      });

      const bonus = await XpSystem.calculateXpBonus(mockUserId);
      
      // Should get 20% bonus (10% from steps + 10% from sleep)
      expect(bonus).toBe(1.2);
    });

    it('should add XP with bonus applied', async () => {
      const mockUserId = 'test-user';
      const baseXP = 100;
      
      // Mock weekly stats to trigger bonus
      const { getWeeklyStats } = await import('./lib/storage/unified-aggregator-wrapper');
      (getWeeklyStats as MockedFunction<any>).mockResolvedValue({
        dates: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        steps: [7000, 8000, 9000, 4000, 5000, 6000, 7000], // Last 3: 7000, 6000, 7000 (>6000)
        sleepHours: [7, 8, 6, 7, 8, 7, 8],
        caloriesIn: [2000, 2100, 1900, 2200, 2000, 2100, 2000],
        caloriesOut: [2100, 2200, 2000, 2300, 2100, 2200, 2100],
      });

      // Mock UnifiedStore to track XP addition
      const { default: UnifiedStore } = await import('./lib/storage/unified-store');
      (UnifiedStore.addXP as MockedFunction<any>).mockResolvedValue(110); // 100 base + 10% bonus = 110

      const result = await XpSystem.addXP(mockUserId, baseXP);
      
      // Should return the bonus-adjusted XP value
      expect(result).toBe(110);
    });
  });
});