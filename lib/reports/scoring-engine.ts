import { 
  ReportScore, 
  WeeklyReportData, 
  WeeklyTotals, 
  ReportHighlight, 
  Recommendation, 
  TrendAnalysis,
  WeekComparison
} from './report-models';

export class ScoringEngine {
  /**
   * Calculate a category-specific score based on weekly data
   */
  static calculateCategoryScore(data: WeeklyReportData, category: string): ReportScore {
    // Simple scoring algorithm based on the category
    const { dailyStats, weeklyTotals } = data;
    
    switch (category) {
      case 'activity':
        // Activity score based on steps, activities, and consistency
        const stepRatio = Math.min(100, (weeklyTotals.avgSteps / 10000) * 100); // 10k steps = 100%
        const activityRatio = Math.min(100, (weeklyTotals.daysWithActivity / 7) * 100); // 7 days = 100%

        const activityScore = (stepRatio * 0.7) + (activityRatio * 0.3);
        
        return {
          value: Math.round(activityScore),
          category: 'activity',
          breakdown: [
            { factor: 'steps', score: Math.round(stepRatio), weight: 0.7, details: 'Average steps per day vs goal' },
            { factor: 'consistency', score: Math.round(activityRatio), weight: 0.3, details: 'Days with activity tracked' }
          ],
          trend: 'stable' // Would require historical data to determine trend
        };
        
      case 'nutrition':
        // Nutrition score based on food logging consistency and calorie balance
        const mealLoggingRatio = Math.min(100, (weeklyTotals.daysWithMeals / 7) * 100); // 7 days = 100%
        const calorieBalanceRatio = Math.min(100, 100 - (Math.abs(weeklyTotals.avgCaloriesIn - weeklyTotals.avgCaloriesOut) / 500) * 100); // Balanced = 100%
        
        const nutritionScore = (mealLoggingRatio * 0.4) + (calorieBalanceRatio * 0.6);
        
        return {
          value: Math.round(nutritionScore),
          category: 'nutrition',
          breakdown: [
            { factor: 'consistency', score: Math.round(mealLoggingRatio), weight: 0.4, details: 'Days with meals logged' },
            { factor: 'balance', score: Math.round(calorieBalanceRatio), weight: 0.6, details: 'Calorie intake vs expenditure balance' }
          ],
          trend: 'stable'
        };
        
      case 'sleep':
        // Sleep score based on hours and consistency
        const sleepHoursRatio = Math.min(100, (weeklyTotals.avgSleepHours / 8) * 100); // 8 hours = 100%
        const sleepConsistency = this.calculateSleepConsistency(dailyStats); // Calculate sleep consistency score
        
        const sleepScore = (sleepHoursRatio * 0.6) + (sleepConsistency * 0.4);
        
        return {
          value: Math.round(sleepScore),
          category: 'sleep',
          breakdown: [
            { factor: 'duration', score: Math.round(sleepHoursRatio), weight: 0.6, details: 'Average sleep duration vs goal' },
            { factor: 'consistency', score: Math.round(sleepConsistency), weight: 0.4, details: 'Sleep consistency throughout the week' }
          ],
          trend: 'stable'
        };
        
      case 'recovery':
        // Recovery score based on activity-rest balance
        const xpRatio = Math.min(100, (weeklyTotals.avgXP / 150) * 100); // 150 XP avg = 100%
        const activityRestBalance = this.calculateActivityRestBalance(dailyStats);
        
        const recoveryScore = (xpRatio * 0.3) + (activityRestBalance * 0.7);
        
        return {
          value: Math.round(recoveryScore),
          category: 'recovery',
          breakdown: [
            { factor: 'xp', score: Math.round(xpRatio), weight: 0.3, details: 'Average XP earned' },
            { factor: 'balance', score: Math.round(activityRestBalance), weight: 0.7, details: 'Activity vs rest balance' }
          ],
          trend: 'stable'
        };
        
      default:
        return {
          value: 0,
          category: category,
          breakdown: [],
          trend: 'stable'
        };
    }
  }

  /**
   * Calculate overall score as weighted average of category scores
   */
  static calculateOverallScore(scores: {
    activity: ReportScore;
    nutrition: ReportScore;
    sleep: ReportScore;
    recovery: ReportScore;
  }): ReportScore {
    // Equal weighting for simplicity
    const overallValue = (scores.activity.value + 
                         scores.nutrition.value + 
                         scores.sleep.value + 
                         scores.recovery.value) / 4;
    
    // Determine trend based on component trends
    const trends = [scores.activity.trend, scores.nutrition.trend, scores.sleep.trend, scores.recovery.trend];
    const improvingCount = trends.filter(t => t === 'improving').length;
    const decliningCount = trends.filter(t => t === 'declining').length;
    
    let overallTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (improvingCount > decliningCount) {
      overallTrend = 'improving';
    } else if (decliningCount > improvingCount) {
      overallTrend = 'declining';
    }
    
    return {
      value: Math.round(overallValue),
      category: 'overall',
      breakdown: [
        { factor: 'activity', score: scores.activity.value, weight: 0.25, details: 'Activity score contribution' },
        { factor: 'nutrition', score: scores.nutrition.value, weight: 0.25, details: 'Nutrition score contribution' },
        { factor: 'sleep', score: scores.sleep.value, weight: 0.25, details: 'Sleep score contribution' },
        { factor: 'recovery', score: scores.recovery.value, weight: 0.25, details: 'Recovery score contribution' }
      ],
      trend: overallTrend
    };
  }

  /**
   * Generate highlights from the weekly data
   */
  static generateHighlights(data: WeeklyReportData): ReportHighlight[] {
    const { dailyStats, weeklyTotals } = data;
    const highlights: ReportHighlight[] = [];

    // Check for good step consistency
    if (weeklyTotals.daysWithActivity >= 5) {
      highlights.push({
        type: 'achievement',
        category: 'activity',
        description: 'Great activity consistency',
        value: `${weeklyTotals.daysWithActivity}/7 days active`
      });
    }

    // Check for good sleep consistency
    if (weeklyTotals.avgSleepHours >= 7.5) {
      highlights.push({
        type: 'win',
        category: 'sleep',
        description: 'Maintained healthy sleep schedule',
        value: `${weeklyTotals.avgSleepHours.toFixed(1)}h avg`
      });
    }

    // Check for good meal logging consistency
    if (weeklyTotals.daysWithMeals >= 5) {
      highlights.push({
        type: 'win',
        category: 'nutrition',
        description: 'Consistent meal tracking',
        value: `${weeklyTotals.daysWithMeals}/7 days logged`
      });
    }

    // Check for calorie balance
    const avgDeficit = Math.abs(weeklyTotals.avgCaloriesIn - weeklyTotals.avgCaloriesOut);
    if (avgDeficit < 200) {
      highlights.push({
        type: 'achievement',
        category: 'nutrition',
        description: 'Well-balanced nutrition',
        value: `±${avgDeficit} cal avg difference`
      });
    }

    // Check for improvement
    if (dailyStats.length >= 2) {
      const firstDaySteps = dailyStats[0]?.steps || 0;
      const lastDaySteps = dailyStats[dailyStats.length - 1]?.steps || 0;
      if (lastDaySteps > firstDaySteps * 1.5) {  // Increased by 50%
        highlights.push({
          type: 'improvement',
          category: 'activity',
          description: 'Significant step improvement',
          value: `${Math.round(((lastDaySteps - firstDaySteps) / firstDaySteps) * 100)}% increase`
        });
      }
    }

    return highlights;
  }

  /**
   * Generate recommendations based on weekly totals
   */
  static generateRecommendations(weeklyTotals: WeeklyTotals): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // If steps are low
    if (weeklyTotals.avgSteps < 7000) {
      recommendations.push({
        category: 'activity',
        priority: 'medium',
        description: 'Average daily steps are below recommended levels',
        target: 'Increase steps to 10,000/day'
      });
    }

    // If sleep is low
    if (weeklyTotals.avgSleepHours < 7) {
      recommendations.push({
        category: 'sleep',
        priority: 'high',
        description: 'Sleep duration is below optimal levels',
        target: 'Aim for 7-8 hours of sleep nightly'
      });
    }

    // If calories are imbalanced
    const avgDeficit = Math.abs(weeklyTotals.avgCaloriesIn - weeklyTotals.avgCaloriesOut);
    if (avgDeficit > 300) {
      recommendations.push({
        category: 'nutrition',
        priority: 'medium',
        description: 'Calorie intake vs expenditure has a large imbalance',
        target: 'Try to balance calories closer to net zero'
      });
    }

    // If meal logging is inconsistent
    if (weeklyTotals.daysWithMeals < 5) {
      recommendations.push({
        category: 'nutrition',
        priority: 'medium',
        description: 'Meal logging has room for improvement',
        target: 'Log meals regularly for better nutrition insights'
      });
    }

    return recommendations;
  }

  /**
   * Generate trend analysis
   */
  static generateTrendAnalysis(data: WeeklyReportData): TrendAnalysis[] {
    const { dailyStats } = data;
    const trends: TrendAnalysis[] = [];

    // Analyze steps trend
    if (dailyStats.length > 1) {
      const stepsData = dailyStats.map(d => d.steps);
      const stepsTrend = this.linearRegressionTrend(stepsData);
      
      trends.push({
        metric: 'steps',
        data: dailyStats.map(d => ({ date: d.date, value: d.steps })),
        direction: stepsTrend.slope > 0.1 ? 'improving' : stepsTrend.slope < -0.1 ? 'declining' : 'stable',
        change: Math.abs(stepsTrend.percentageChange),
        description: stepsTrend.slope > 0.1 ? 'Steps are increasing throughout the week' :
                    stepsTrend.slope < -0.1 ? 'Steps are decreasing throughout the week' : 'Steps are steady'
      });
    }

    // Analyze caloriesIn trend
    if (dailyStats.length > 1) {
      const caloriesInData = dailyStats.map(d => d.caloriesIn);
      const caloriesInTrend = this.linearRegressionTrend(caloriesInData);
      
      trends.push({
        metric: 'caloriesIn',
        data: dailyStats.map(d => ({ date: d.date, value: d.caloriesIn })),
        direction: caloriesInTrend.slope > 0.1 ? 'improving' : caloriesInTrend.slope < -0.1 ? 'declining' : 'stable',
        change: Math.abs(caloriesInTrend.percentageChange),
        description: caloriesInTrend.slope > 0.1 ? 'Calorie intake is increasing' :
                    caloriesInTrend.slope < -0.1 ? 'Calorie intake is decreasing' : 'Calorie intake is stable'
      });
    }

    // Analyze caloriesOut trend
    if (dailyStats.length > 1) {
      const caloriesOutData = dailyStats.map(d => d.caloriesOut);
      const caloriesOutTrend = this.linearRegressionTrend(caloriesOutData);
      
      trends.push({
        metric: 'caloriesOut',
        data: dailyStats.map(d => ({ date: d.date, value: d.caloriesOut })),
        direction: caloriesOutTrend.slope > 0.1 ? 'improving' : caloriesOutTrend.slope < -0.1 ? 'declining' : 'stable',
        change: Math.abs(caloriesOutTrend.percentageChange),
        description: caloriesOutTrend.slope > 0.1 ? 'Calorie burn is increasing' :
                    caloriesOutTrend.slope < -0.1 ? 'Calorie burn is decreasing' : 'Calorie burn is stable'
      });
    }

    // Analyze sleep trend
    if (dailyStats.length > 1) {
      const sleepData = dailyStats.map(d => d.sleepHours);
      const sleepTrend = this.linearRegressionTrend(sleepData);
      
      trends.push({
        metric: 'sleep',
        data: dailyStats.map(d => ({ date: d.date, value: d.sleepHours })),
        direction: sleepTrend.slope > 0.1 ? 'improving' : sleepTrend.slope < -0.1 ? 'declining' : 'stable',
        change: Math.abs(sleepTrend.percentageChange),
        description: sleepTrend.slope > 0.1 ? 'Sleep quality/duration is improving' :
                    sleepTrend.slope < -0.1 ? 'Sleep quality/duration is declining' : 'Sleep is consistent'
      });
    }

    return trends;
  }

  /**
   * Generate week comparison data
   */
  static generateWeekComparison(
    currentData: WeeklyReportData, 
    prevData?: WeeklyReportData
  ): WeekComparison {
    const currentTotals = currentData.weeklyTotals;
    
    // Default previous week data if not provided
    const prevTotals = prevData ? prevData.weeklyTotals : {
      totalSteps: currentTotals.totalSteps * 0.95,  // Default: 5% less than current week
      totalCaloriesIn: currentTotals.totalCaloriesIn * 0.98,
      totalCaloriesOut: currentTotals.totalCaloriesOut * 0.97,
      totalSleepHours: currentTotals.totalSleepHours * 0.99,
      totalXP: currentTotals.totalXP * 0.96,
      avgSteps: currentTotals.avgSteps * 0.95,
      avgCaloriesIn: currentTotals.avgCaloriesIn * 0.98,
      avgCaloriesOut: currentTotals.avgCaloriesOut * 0.97,
      avgSleepHours: currentTotals.avgSleepHours * 0.99,
      avgXP: currentTotals.avgXP * 0.96,
      daysWithActivity: Math.max(0, currentTotals.daysWithActivity - 1), // Default: 1 day less
      daysWithMeals: Math.max(0, currentTotals.daysWithMeals - 1)
    };

    // Calculate percentage differences
    const differences = {
      steps: currentTotals.totalSteps && prevTotals.totalSteps 
        ? ((currentTotals.totalSteps - prevTotals.totalSteps) / Math.abs(prevTotals.totalSteps)) * 100 
        : 0,
      caloriesIn: currentTotals.totalCaloriesIn && prevTotals.totalCaloriesIn
        ? ((currentTotals.totalCaloriesIn - prevTotals.totalCaloriesIn) / Math.abs(prevTotals.totalCaloriesIn)) * 100
        : 0,
      caloriesOut: currentTotals.totalCaloriesOut && prevTotals.totalCaloriesOut
        ? ((currentTotals.totalCaloriesOut - prevTotals.totalCaloriesOut) / Math.abs(prevTotals.totalCaloriesOut)) * 100
        : 0,
      sleep: currentTotals.totalSleepHours && prevTotals.totalSleepHours
        ? ((currentTotals.totalSleepHours - prevTotals.totalSleepHours) / Math.abs(prevTotals.totalSleepHours)) * 100
        : 0,
      xp: currentTotals.totalXP && prevTotals.totalXP
        ? ((currentTotals.totalXP - prevTotals.totalXP) / Math.abs(prevTotals.totalXP)) * 100
        : 0
    };

    return {
      prevWeek: prevTotals,
      currentWeek: currentTotals,
      differences
    };
  }

  /**
   * Calculate sleep consistency score (0-100)
   */
  private static calculateSleepConsistency(dailyStats: any[]): number {
    if (dailyStats.length === 0) return 50;
    
    const sleepHours = dailyStats.map(d => d.sleepHours || 0);
    const avg = sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length;
    const variance = sleepHours.reduce((sum, hours) => sum + Math.pow(hours - avg, 2), 0) / sleepHours.length;
    
    // Lower variance = better consistency, max 100%
    const consistencyScore = Math.max(0, 100 - variance * 10); // Scale variance to score
    return Math.min(100, consistencyScore);
  }

  /**
   * Calculate activity-rest balance (0-100)
   */
  private static calculateActivityRestBalance(dailyStats: any[]): number {
    if (dailyStats.length === 0) return 50;
    
    // Balance score based on steps vs sleep relationship
    const avgSteps = dailyStats.reduce((sum, d) => sum + (d.steps || 0), 0) / dailyStats.length;
    const avgSleep = dailyStats.reduce((sum, d) => sum + (d.sleepHours || 0), 0) / dailyStats.length;
    
    // Optimal balance: high activity with good sleep
    if (avgSteps > 8000 && avgSleep > 7) {
      return 100; // Perfect balance
    } else if (avgSteps > 5000 && avgSleep > 6) {
      return 80; // Good balance
    } else if (avgSteps > 3000 && avgSleep > 5) {
      return 60; // Fair balance
    } else {
      return 40; // Needs improvement
    }
  }

  /**
   * Calculate linear regression trend (slope and percentage change)
   */
  private static linearRegressionTrend(data: number[]): { slope: number; percentageChange: number } {
    if (data.length <= 1) return { slope: 0, percentageChange: 0 };

    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Calculate percentage change from first to last value
    const firstValue = data[0] || 0;
    const lastValue = data[data.length - 1] || 0;
    const percentageChange = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    return { slope, percentageChange };
  }
}