import { TimeAggregate } from '@/data/models/wellness-record';

/**
 * Data models for adaptive goals
 */

interface DailyGoals {
  userId: string;
  date: string; // ISO date
  goals: {
    steps: GoalMetric;
    caloriesBurned: GoalMetric;
    sleepHours: GoalMetric;
  };
  metadata: {
    isAdapted: boolean;
    adaptationReason: AdaptationReason;
    confidence: number; // 0-1
    previousGoalDelta: GoalDelta;
    behaviorPatterns: BehaviorPatterns;
  };
}

interface GoalMetric {
  target: number;
  current: number;
  unit: string;
  streak: number;
  difficulty: 'easy' | 'moderate' | 'challenging';
  historicalAverage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface GoalDelta {
  previousTarget: number;
  newTarget: number;
  changeAmount: number;
  changePercentage: number;
  direction: 'increase' | 'decrease' | 'maintain';
  reason: string;
}

interface BehaviorPatterns {
  underGoalStreak: number; // Consecutive days under goal
  overGoalStreak: number;  // Consecutive days over goal
  consistencyScore: number; // 0-100
  performanceTrend: 'improving' | 'declining' | 'stable';
  adaptationNeeded: boolean;
  fatigueSigns: boolean;
  motivationLevel: 'high' | 'medium' | 'low';
}

type AdaptationReason = 'consistency_improvement' | 'performance_decline' | 
  'fatigue_detection' | 'maintenance_mode' | 'streak_compensation';

export type { DailyGoals };
export type { GoalMetric };
export type { GoalDelta };
export type { BehaviorPatterns };
export type { AdaptationReason };