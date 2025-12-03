import { DailyGoals, GoalDelta, BehaviorPatterns, GoalMetric } from '../types/adaptive-goals';
import { TimeAggregate } from '@/data/models/wellness-record';

/**
 * Core engine for adaptive goal calculation
 */
export class AdaptiveGoalsEngine {
  private static readonly DEFAULT_BASE_STEPS = 8000;
  private static readonly DEFAULT_BASE_CALORIES_BURNED = 300;
  private static readonly DEFAULT_BASE_SLEEP_HOURS = 7.5;

  /**
   * Calculate adaptive goals for a specific date
   */
  static async calculateAdaptiveGoals(userId: string, date: Date = new Date()): Promise<DailyGoals> {
    console.log(`[ADAPTIVE GOALS] Calculating goals for user: ${userId}, date: ${date.toISOString()}`);
    
    // Get historical performance data
    const historicalData = await this.getUserHistoricalData(userId, date);

    // Analyze behavior patterns
    const behaviorPatterns = this.analyzeBehaviorPatterns(historicalData);

    // Calculate base goals from user profile or defaults
    const baseGoals = this.calculateBaseGoals(userId);

    // Apply adaptive adjustments
    const adaptedGoals = this.applyAdaptiveAdjustments(userId, date, baseGoals, behaviorPatterns, historicalData);

    // Store with metadata
    await this.storeDailyGoals(userId, date, adaptedGoals, behaviorPatterns);

    console.log(`[ADAPTIVE GOALS] Calculated goals:`, adaptedGoals);
    
    return adaptedGoals;
  }

  /**
   * Get historical data for the last 7 days
   */
  private static async getUserHistoricalData(userId: string, currentDate: Date): Promise<TimeAggregate[]> {
    const historicalData: TimeAggregate[] = [];

    // Get data for the past 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() - i);

      // Import dynamically to avoid circular dependency
      const { default: UnifiedStore } = await import('../storage/unified-store');
      const dailyData = await UnifiedStore.getDailyAggregatedData(userId, date);
      historicalData.push(dailyData);
    }

    return historicalData;
  }

  /**
   * Analyze behavior patterns from historical data
   */
  private static analyzeBehaviorPatterns(historicalData: TimeAggregate[]): BehaviorPatterns {
    // Calculate under-goal and over-goal streaks
    let underGoalStreak = 0;
    let overGoalStreak = 0;
    let maxUnderStreak = 0;
    let maxOverStreak = 0;
    
    // Track recent performance
    let recentPerformance = 0;
    const performanceWindow = Math.min(7, historicalData.length);
    
    for (let i = 0; i < performanceWindow; i++) {
      const day = historicalData[i];
      
      // Check steps performance (using 8000 as base for now)
      if (day.totals.steps < 8000) {
        underGoalStreak++;
        overGoalStreak = 0;
        maxUnderStreak = Math.max(maxUnderStreak, underGoalStreak);
      } else {
        overGoalStreak++;
        underGoalStreak = 0;
        maxOverStreak = Math.max(maxOverStreak, overGoalStreak);
      }
      
      if (day.totals.steps > 0) {
        recentPerformance += day.totals.steps;
      }
    }
    
    // Calculate consistency score (0-100 based on hitting targets)
    let consistencyScore = 0;
    if (historicalData.length > 0) {
      const daysWithSteps = historicalData.filter(day => day.totals.steps > 0).length;
      consistencyScore = Math.round((daysWithSteps / historicalData.length) * 100);
    }
    
    // Determine performance trend
    let performanceTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (historicalData.length >= 2) {
      const recentAvg = historicalData.slice(0, 3).reduce((sum, day) => sum + day.totals.steps, 0) / 3;
      const earlierAvg = historicalData.slice(3, 6).reduce((sum, day) => sum + day.totals.steps, 0) / 3;
      
      if (recentAvg > earlierAvg * 1.1) {
        performanceTrend = 'improving';
      } else if (recentAvg < earlierAvg * 0.9) {
        performanceTrend = 'declining';
      }
    }
    
    // Detect fatigue signs (if consistently overperforming)
    const fatigueSigns = performanceTrend === 'declining' && consistencyScore > 70;
    
    // Estimate motivation level based on consistency and recent performance
    let motivationLevel: 'high' | 'medium' | 'low' = 'medium';
    if (consistencyScore > 80) {
      motivationLevel = 'high';
    } else if (consistencyScore < 50) {
      motivationLevel = 'low';
    }
    
    const behaviorPatterns: BehaviorPatterns = {
      underGoalStreak: maxUnderStreak,
      overGoalStreak: maxOverStreak,
      consistencyScore,
      performanceTrend,
      adaptationNeeded: maxUnderStreak >= 3 || maxOverStreak >= 5,
      fatigueSigns,
      motivationLevel
    };
    
    console.log(`[ADAPTIVE GOALS] Behavior patterns:`, behaviorPatterns);
    
    return behaviorPatterns;
  }

  /**
   * Calculate base goals from user profile or defaults
   */
  private static calculateBaseGoals(userId: string): { steps: number; caloriesBurned: number; sleepHours: number; } {
    // In a real implementation, this would pull from user profile
    // For now, using default values
    return {
      steps: this.DEFAULT_BASE_STEPS,
      caloriesBurned: this.DEFAULT_BASE_CALORIES_BURNED,
      sleepHours: this.DEFAULT_BASE_SLEEP_HOURS
    };
  }

  /**
   * Apply adaptive adjustments to base goals
   */
  private static applyAdaptiveAdjustments(
    userId: string,
    date: Date,
    baseGoals: { steps: number; caloriesBurned: number; sleepHours: number; },
    patterns: BehaviorPatterns,
    historicalData: TimeAggregate[]
  ): DailyGoals {
    console.log(`[ADAPTIVE GOALS] Applying adjustments with patterns:`, patterns);
    
    // Calculate historical averages
    const avgSteps = historicalData.length 
      ? historicalData.reduce((sum, day) => sum + day.totals.steps, 0) / historicalData.length 
      : baseGoals.steps;
    
    // Adjust steps goal
    let stepsDelta: GoalDelta;
    let newStepsTarget = baseGoals.steps;
    let stepsReason = 'maintenance';
    
    if (patterns.underGoalStreak >= 4) {
      // Reduce goal if consistently underachieving
      newStepsTarget = Math.max(3000, Math.floor(baseGoals.steps * 0.85)); // Reduce by 15%, minimum 3000
      stepsReason = 'reducing_due_consistent_under_achievement';
    } else if (patterns.overGoalStreak >= 5) {
      // Increase goal if consistently overachieving
      newStepsTarget = Math.min(20000, Math.floor(baseGoals.steps * 1.15)); // Increase by 15%, maximum 20000
      stepsReason = 'increasing_due_consistent_over_achievement';
    } else if (patterns.fatigueSigns) {
      // Reduce goal if fatigue detected
      newStepsTarget = Math.floor(baseGoals.steps * 0.9); // Reduce by 10%
      stepsReason = 'reducing_due_fatigue_signs';
    }
    
    stepsDelta = {
      previousTarget: baseGoals.steps,
      newTarget: newStepsTarget,
      changeAmount: newStepsTarget - baseGoals.steps,
      changePercentage: ((newStepsTarget - baseGoals.steps) / baseGoals.steps) * 100,
      direction: newStepsTarget > baseGoals.steps ? 'increase' :
                  newStepsTarget < baseGoals.steps ? 'decrease' : 'maintain',
      reason: stepsReason
    };
    
    // Adjust calories burned goal (similar logic)
    let caloriesDelta: GoalDelta;
    let newCaloriesTarget = baseGoals.caloriesBurned;
    let caloriesReason = 'maintenance';
    
    // Get historical average for calories burned
    const avgCalories = historicalData.length 
      ? historicalData.reduce((sum, day) => sum + day.totals.caloriesBurned, 0) / historicalData.length 
      : baseGoals.caloriesBurned;
    
    if (avgCalories < baseGoals.caloriesBurned * 0.7) {  // If consistently below 70% of goal
      newCaloriesTarget = Math.max(150, Math.floor(baseGoals.caloriesBurned * 0.85));
      caloriesReason = 'reducing_due_consistent_under_achievement';
    } else if (avgCalories > baseGoals.caloriesBurned * 1.3) {  // If consistently above 130% of goal
      newCaloriesTarget = Math.min(800, Math.floor(baseGoals.caloriesBurned * 1.15));
      caloriesReason = 'increasing_due_consistent_over_achievement';
    }
    
    caloriesDelta = {
      previousTarget: baseGoals.caloriesBurned,
      newTarget: newCaloriesTarget,
      changeAmount: newCaloriesTarget - baseGoals.caloriesBurned,
      changePercentage: ((newCaloriesTarget - baseGoals.caloriesBurned) / baseGoals.caloriesBurned) * 100,
      direction: newCaloriesTarget > baseGoals.caloriesBurned ? 'increase' :
                  newCaloriesTarget < baseGoals.caloriesBurned ? 'decrease' : 'maintain',
      reason: caloriesReason
    };
    
    // Adjust sleep goal (typically more stable)
    let sleepDelta: GoalDelta;
    let newSleepTarget = baseGoals.sleepHours;
    let sleepReason = 'maintenance';
    
    // Sleep goals change less frequently, only adjust if significantly off
    if (historicalData.length > 0) {
      const avgSleep = historicalData.reduce((sum, day) => sum + day.totals.sleepHours, 0) / historicalData.length;
      
      if (avgSleep < 6.0) {  // Consistently sleeping too little
        newSleepTarget = Math.min(9, baseGoals.sleepHours + 0.5);  // Increase slightly
        sleepReason = 'increasing_due_consistent_under_achievement';
      } else if (avgSleep > 9.0) {  // Consistently sleeping too much
        newSleepTarget = Math.max(6, baseGoals.sleepHours - 0.5);  // Decrease slightly  
        sleepReason = 'decreasing_due_consistent_over_achievement';
      }
    }
    
    sleepDelta = {
      previousTarget: baseGoals.sleepHours,
      newTarget: newSleepTarget,
      changeAmount: newSleepTarget - baseGoals.sleepHours,
      changePercentage: ((newSleepTarget - baseGoals.sleepHours) / baseGoals.sleepHours) * 100,
      direction: newSleepTarget > baseGoals.sleepHours ? 'increase' :
                  newSleepTarget < baseGoals.sleepHours ? 'decrease' : 'maintain',
      reason: sleepReason
    };
    
    // Create the final goals object
    const dailyGoals: DailyGoals = {
      userId,
      date: date.toISOString().split('T')[0],
      goals: {
        steps: {
          target: newStepsTarget,
          current: 0, // Will be updated based on today's data
          unit: 'steps',
          streak: patterns.overGoalStreak,
          difficulty: this.estimateDifficulty(newStepsTarget, avgSteps),
          historicalAverage: avgSteps,
          trend: patterns.performanceTrend === 'improving' ? 'increasing' :
                 patterns.performanceTrend === 'declining' ? 'decreasing' :
                 'stable'
        },
        caloriesBurned: {
          target: newCaloriesTarget,
          current: 0, // Will be updated based on today's data
          unit: 'kcal',
          streak: 0, // To be calculated based on actual performance
          difficulty: this.estimateDifficulty(newCaloriesTarget, avgCalories),
          historicalAverage: avgCalories,
          trend: patterns.performanceTrend === 'improving' ? 'increasing' :
                 patterns.performanceTrend === 'declining' ? 'decreasing' :
                 'stable'
        },
        sleepHours: {
          target: newSleepTarget,
          current: 0, // Will be updated based on today's data
          unit: 'hours',
          streak: 0, // To be calculated based on actual performance
          difficulty: this.estimateDifficulty(newSleepTarget, baseGoals.sleepHours),
          historicalAverage: baseGoals.sleepHours, // Sleep base is typically the average
          trend: patterns.performanceTrend === 'improving' ? 'increasing' :
                 patterns.performanceTrend === 'declining' ? 'decreasing' :
                 'stable'
        }
      },
      metadata: {
        isAdapted: patterns.adaptationNeeded,
        adaptationReason: stepsReason as any,  // Simplified for now
        confidence: 0.8, // Base confidence
        previousGoalDelta: stepsDelta, // Using steps as main indicator for now
        behaviorPatterns: patterns
      }
    };
    
    return dailyGoals;
  }

  /**
   * Store daily goals using GoalsStorage
   */
  private static async storeDailyGoals(
    userId: string,
    date: Date,
    goals: DailyGoals,
    patterns: BehaviorPatterns
  ): Promise<void> {
    // Use the GoalsStorage class to handle storage
    const { GoalsStorage } = await import('../storage/goals-storage');
    await GoalsStorage.storeDailyGoals(userId, date, goals, patterns);

    console.log(`[ADAPTIVE GOALS] Stored goals for user ${userId} on ${date.toISOString().split('T')[0]}`);
  }

  /**
   * Estimate difficulty level based on target compared to historical performance
   */
  private static estimateDifficulty(target: number, historicalAvg: number): 'easy' | 'moderate' | 'challenging' {
    if (target < historicalAvg * 0.8) {
      return 'easy';
    } else if (target > historicalAvg * 1.2) {
      return 'challenging';
    } else {
      return 'moderate';
    }
  }
}