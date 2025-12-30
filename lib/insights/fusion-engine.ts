import { WellnessRecord } from '@/data/models/wellness-record';
import ClientSafeUnifiedStore from '@/lib/storage/client-safe-unified-store';
import { CorrelationCalculator } from './correlation-calculator';

// Type definitions
export interface FusionInsight {
  id: string;
  date: Date;
  category: 'meal-sleep' | 'nutrition-recovery' | 'activity-sleep';
  insight: string;
  recommendation: string;
  score: number; // 0-100 confidence score
  correlationData?: any;
}

export interface CorrelationMetrics {
  mealSleepCorrelation: number; // -1 to 1 correlation coefficient
  timingImpact: number; // Impact of meal timing on sleep quality
  nutritionQualityImpact: number; // Impact of nutritional quality on sleep
  recoveryScore: number; // Overall recovery score (0-100)
  mealQualityTrend: number; // Trend in meal quality over time
}

export interface CorrelationResult {
  correlation: number;
  pValue: number;
  significance: 'high' | 'medium' | 'low';
  description: string;
}

export interface MealTimingRecommendation {
  optimalDinnerTime: string;
  mealSpacing: {
    breakfastToLunch: string;
    lunchToDinner: string;
    dinnerToSleep: string;
  };
  confidence: number;
}

/**
 * Insight Fusion Engine
 * Combines meal, sleep, and other wellness data to generate cross-domain insights
 */
export class InsightFusionEngine {
  private correlationCalculator: CorrelationCalculator;

  constructor() {
    this.correlationCalculator = new CorrelationCalculator();
  }

  /**
   * Generate meal + sleep fusion insights for a specific date
   */
  async generateMealSleepInsights(userId: string, date: Date): Promise<FusionInsight[]> {
    console.log(`[FUSION ENGINE] Generating meal-sleep insights for user: ${userId}, date: ${date.toISOString()}`);

    // Get 7 days of data around the target date for trend analysis
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start from Sunday
    
    const endDate = new Date(weekStart);
    endDate.setDate(weekStart.getDate() + 6);

    const records = await ClientSafeUnifiedStore.getRecordsForPeriod(userId, weekStart, endDate);
    
    // Separate by type
    const meals = records.filter(r => r.type === 'meal');
    const sleepRecords = records.filter(r => r.type === 'sleep');

    // Generate fusion insights based on correlations
    const insights: FusionInsight[] = [];

    // Correlation between meal timing and sleep quality
    if (sleepRecords.length > 0 && meals.length > 0) {
      const timingCorrelation = this.correlationCalculator.calculateMealSleepTimingCorrelation(meals, sleepRecords);
      
      if (timingCorrelation.correlation < -0.3) { // Negative correlation, timing affects sleep negatively
        insights.push({
          id: `meal-sleep-timing-${date.toISOString()}`,
          date,
          category: 'meal-sleep',
          insight: `Your meal timing appears to be affecting your sleep quality. Late dinners correlate with poorer sleep quality.`,
          recommendation: `Try to finish your dinner at least 3 hours before bedtime to improve your sleep quality.`,
          score: Math.abs(timingCorrelation.correlation) * 100,
          correlationData: {
            correlation: timingCorrelation.correlation,
            pValue: timingCorrelation.pValue,
            significance: timingCorrelation.significance
          }
        });
      }
      
      if (timingCorrelation.correlation > 0.3) { // Positive correlation, timing affects sleep positively
        insights.push({
          id: `meal-sleep-timing-positive-${date.toISOString()}`,
          date,
          category: 'meal-sleep',
          insight: `Great job! Your meal timing seems to be positively impacting your sleep quality.`,
          recommendation: `Keep up your good meal timing habits to maintain good sleep quality.`,
          score: timingCorrelation.correlation * 100,
          correlationData: {
            correlation: timingCorrelation.correlation,
            pValue: timingCorrelation.pValue,
            significance: timingCorrelation.significance
          }
        });
      }
    }

    // Nutritional impact on sleep quality
    const nutritionSleepCorrelation = this.correlationCalculator.calculateNutritionSleepQualityCorrelation(meals, sleepRecords);
    
    if (nutritionSleepCorrelation.correlation < -0.3) {
      insights.push({
        id: `nutrition-sleep-quality-${date.toISOString()}`,
        date,
        category: 'nutrition-recovery',
        insight: `Your meal composition may be affecting your sleep quality. Consider adjusting your intake of certain nutrients.`,
        recommendation: `Reduce caffeine and sugar intake after 4 PM and include more magnesium-rich foods to improve sleep quality.`,
        score: Math.abs(nutritionSleepCorrelation.correlation) * 100,
        correlationData: {
          correlation: nutritionSleepCorrelation.correlation,
          pValue: nutritionSleepCorrelation.pValue,
          significance: nutritionSleepCorrelation.significance
        }
      });
    }

    console.log(`[FUSION ENGINE] Generated ${insights.length} meal-sleep fusion insights for user: ${userId}`);
    return insights;
  }

  /**
   * Calculate comprehensive correlation metrics
   */
  async calculateCorrelationMetrics(userId: string): Promise<CorrelationMetrics> {
    console.log(`[FUSION ENGINE] Calculating correlation metrics for user: ${userId}`);

    // Get the last 30 days of data for comprehensive analysis
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const records = await ClientSafeUnifiedStore.getRecordsForPeriod(userId, startDate, endDate);

    // Separate by type
    const meals = records.filter(r => r.type === 'meal');
    const sleepRecords = records.filter(r => r.type === 'sleep');
    const activities = records.filter(r => r.type === 'activity');

    // Calculate various correlations
    let mealSleepCorrelation = 0;
    let timingImpact = 0;
    let nutritionQualityImpact = 0;
    let recoveryScore = 0;
    let mealQualityTrend = 0;

    if (sleepRecords.length > 0 && meals.length > 0) {
      // Calculate meal-sleep correlation
      const timingCorrelation = this.correlationCalculator.calculateMealSleepTimingCorrelation(meals, sleepRecords);
      mealSleepCorrelation = timingCorrelation.correlation;

      // Calculate timing impact
      timingImpact = timingCorrelation.correlation;

      // Calculate nutrition quality impact on sleep
      const nutritionSleepCorrelation = this.correlationCalculator.calculateNutritionSleepQualityCorrelation(meals, sleepRecords);
      nutritionQualityImpact = nutritionSleepCorrelation.correlation;
    }

    // Calculate recovery score based on sleep, activity, and nutrition
    recoveryScore = this.calculateRecoveryScore(sleepRecords, activities, meals);

    // Calculate meal quality trend
    mealQualityTrend = this.calculateMealQualityTrend(meals);

    const metrics: CorrelationMetrics = {
      mealSleepCorrelation,
      timingImpact,
      nutritionQualityImpact,
      recoveryScore,
      mealQualityTrend
    };

    console.log(`[FUSION ENGINE] Calculated correlation metrics for user: ${userId}`, metrics);
    return metrics;
  }

  /**
   * Calculate recovery score based on multiple factors
   */
  private calculateRecoveryScore(sleepRecords: WellnessRecord[], activities: WellnessRecord[], meals: WellnessRecord[]): number {
    if (sleepRecords.length === 0) return 50; // Default score if no sleep data

    // Calculate average sleep quality
    const avgSleepQuality = sleepRecords.reduce((sum, record) => sum + (record.metrics.quality || 0), 0) / sleepRecords.length;

    // Calculate average sleep duration (in hours)
    const avgSleepDuration = sleepRecords.reduce((sum, record) => sum + (record.metrics.duration || 0), 0) / sleepRecords.length / 60; // Convert minutes to hours

    // Calculate activity-rest balance (simplified)
    const avgActivityDuration = activities.reduce((sum, record) => sum + (record.metrics.duration || 0), 0) / (activities.length || 1);

    // Recovery score based on sleep quality and duration
    let recoveryScore = 0;
    
    // Sleep quality contributes 40%
    recoveryScore += avgSleepQuality * 40;

    // Sleep duration contributes 30% (optimal is 7-9 hours)
    if (avgSleepDuration >= 7 && avgSleepDuration <= 9) {
      recoveryScore += 30; // Full points for optimal duration
    } else if (avgSleepDuration > 5 && avgSleepDuration < 7) {
      recoveryScore += (avgSleepDuration - 5) * 7.5; // Proportional points
    } else if (avgSleepDuration > 9 && avgSleepDuration < 11) {
      recoveryScore += (11 - avgSleepDuration) * 7.5; // Proportional points for too much sleep
    }

    // Activity-rest balance contributes 30%
    if (avgActivityDuration > 0 && avgSleepDuration > 0) {
      // Balance between activity and recovery time
      const balance = Math.min(avgSleepDuration / (avgActivityDuration / 60), 1) * 30;
      recoveryScore += balance;
    }

    return Math.min(100, Math.max(0, recoveryScore));
  }

  /**
   * Calculate meal quality trend
   */
  private calculateMealQualityTrend(meals: WellnessRecord[]): number {
    if (meals.length === 0) return 0;

    // Calculate average calories per meal for the most recent period
    const recentMeals = meals.slice(-7); // Last 7 meals for trend analysis
    const avgRecentCalories = recentMeals.reduce((sum, meal) => sum + (meal.metrics.calories || 0), 0) / recentMeals.length;

    // Calculate average calories per meal for the earlier period
    const earlierMeals = meals.slice(-14, -7); // Previous 7 meals
    if (earlierMeals.length === 0) return 50; // Default if insufficient data

    const avgEarlierCalories = earlierMeals.reduce((sum, meal) => sum + (meal.metrics.calories || 0), 0) / earlierMeals.length;

    // Calculate trend (positive is good trend toward better nutrition)
    const trend = ((avgRecentCalories - avgEarlierCalories) / (avgEarlierCalories || 1)) * 100;

    // Normalize to 0-100 scale
    return Math.min(100, Math.max(0, 50 + trend));
  }

  /**
   * Find optimal meal timing based on sleep patterns
   */
  async findOptimalMealTiming(userId: string, daysToAnalyze: number = 30): Promise<MealTimingRecommendation> {
    console.log(`[FUSION ENGINE] Finding optimal meal timing for user: ${userId}, analyzing ${daysToAnalyze} days`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysToAnalyze);

    const records = await ClientSafeUnifiedStore.getRecordsForPeriod(userId, startDate, endDate);

    // Separate by type
    const meals = records.filter(r => r.type === 'meal').sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const sleepRecords = records.filter(r => r.type === 'sleep').sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Initialize recommendations with default values
    const recommendation: MealTimingRecommendation = {
      optimalDinnerTime: '19:00', // Default 7 PM
      mealSpacing: {
        breakfastToLunch: '4-5 hours',
        lunchToDinner: '5-6 hours',
        dinnerToSleep: '3-4 hours'
      },
      confidence: 0.5
    };

    if (meals.length === 0 || sleepRecords.length === 0) {
      console.log(`[FUSION ENGINE] Insufficient data to calculate optimal meal timing for user: ${userId}`);
      return recommendation;
    }

    // Analyze meal timing patterns
    const dinnerTimes = meals
      .filter(meal => new Date(meal.timestamp).getHours() >= 17) // Dinner time (after 5 PM)
      .map(meal => new Date(meal.timestamp).getHours() + new Date(meal.timestamp).getMinutes() / 60);

    if (dinnerTimes.length > 0) {
      // Calculate average dinner time
      const avgDinnerHour = dinnerTimes.reduce((sum, time) => sum + time, 0) / dinnerTimes.length;
      const avgDinnerHourInt = Math.floor(avgDinnerHour);
      const avgDinnerMinute = Math.round((avgDinnerHour - avgDinnerHourInt) * 60);
      
      recommendation.optimalDinnerTime = `${avgDinnerHourInt.toString().padStart(2, '0')}:${avgDinnerMinute.toString().padStart(2, '0')}`;
    }

    // Analyze sleep patterns to determine optimal dinner-sleep interval
    const sleepIntervals = sleepRecords.map(sleep => {
      // Find the last meal before this sleep session
      const sleepStartTime = new Date(sleep.timestamp);
      const lastMealBefore = [...meals].reverse().find(meal => 
        new Date(meal.timestamp) < sleepStartTime
      );

      if (lastMealBefore) {
        const mealTime = new Date(lastMealBefore.timestamp);
        const intervalHours = (sleepStartTime.getTime() - mealTime.getTime()) / (1000 * 60 * 60);
        return intervalHours;
      }
      return null;
    }).filter(interval => interval !== null) as number[];

    if (sleepIntervals.length > 0) {
      const avgInterval = sleepIntervals.reduce((sum, interval) => sum + interval, 0) / sleepIntervals.length;
      recommendation.mealSpacing.dinnerToSleep = `${Math.max(2, Math.min(6, Math.round(avgInterval)))}-4 hours`;
      
      // Set confidence based on data availability
      recommendation.confidence = Math.min(1.0, Math.max(0.1, sleepIntervals.length / 10));
    }

    console.log(`[FUSION ENGINE] Calculated optimal meal timing for user: ${userId}`, recommendation);
    return recommendation;
  }
}