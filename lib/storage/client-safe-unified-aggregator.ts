import ClientSafeUnifiedStore from './client-safe-unified-store';
import { TimeAggregate, WellnessRecord } from '@/data/models/wellness-record';

/**
 * Client-safe unified aggregator for insights page
 * Gathers data from all wellness categories using the client-safe unified storage system
 */
class ClientSafeUnifiedAggregator {
  // Cache to store ongoing requests to prevent duplicate calls
  private static ongoingRequests = new Map<string, Promise<any>>();

  /**
   * Create a unique cache key from the arguments
   */
  private static createCacheKey(userId: string, date?: Date, type?: string): string {
    const dateStr = date ? date.toISOString().split('T')[0] : 'default';
    return `${userId}:${type}:${dateStr}`;
  }

  /**
   * Get aggregated data for insights page
   */
  static async getInsightsData(userId: string) {
    const cacheKey = this.createCacheKey(userId, undefined, 'insights');

    // Check if there's already an ongoing request for this user
    if (this.ongoingRequests.has(cacheKey)) {
      console.log('Returning ongoing request for insights data:', cacheKey);
      return this.ongoingRequests.get(cacheKey);
    }

    console.log('Fetching unified insights data for user:', userId);

    // Create a new promise for this request
    const requestPromise = this.performGetInsightsData(userId)
      .finally(() => {
        // Clean up the ongoing request when it completes
        this.ongoingRequests.delete(cacheKey);
      });

    // Store the promise to prevent duplicate requests
    this.ongoingRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * Perform the actual getInsightsData operation
   */
  private static async performGetInsightsData(userId: string) {
    // Get today's aggregated data
    const todayData = await ClientSafeUnifiedStore.getDailyAggregatedData(userId);
    console.log('Retrieved today data:', todayData);

    // Get weekly aggregated data
    const weekData = await ClientSafeUnifiedStore.getWeeklyAggregatedData(userId);
    console.log('Retrieved week data:', weekData);

    // Generate chart-ready datasets
    const chartData = await this.generateChartData(userId);
    console.log('Generated chart data:', chartData);

    // Get recent records
    const recentRecords = await this.getRecentRecords(userId);
    console.log('Retrieved recent records:', {
      activities: recentRecords.activities.length,
      meals: recentRecords.meals.length,
      sleep: recentRecords.sleep.length
    });

    return {
      today: this.formatTodayData(todayData),
      week: chartData,
      recentActivities: recentRecords.activities,
      recentMeals: recentRecords.meals,
      recentSleep: recentRecords.sleep
    };
  }

  /**
   * Get daily statistics for a specific date
   */
  static async getDailyStats(userId: string, date: Date = new Date()): Promise<any> {
    const cacheKey = this.createCacheKey(userId, date, 'daily');

    // Check if there's already an ongoing request for this user and date
    if (this.ongoingRequests.has(cacheKey)) {
      console.log('Returning ongoing request for daily stats:', cacheKey);
      return this.ongoingRequests.get(cacheKey);
    }

    console.log('Fetching daily stats for user:', userId, 'on date:', date);

    // Create a new promise for this request
    const requestPromise = this.performGetDailyStats(userId, date)
      .finally(() => {
        // Clean up the ongoing request when it completes
        this.ongoingRequests.delete(cacheKey);
      });

    // Store the promise to prevent duplicate requests
    this.ongoingRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * Perform the actual getDailyStats operation
   */
  private static async performGetDailyStats(userId: string, date: Date): Promise<any> {
    const dailyData = await ClientSafeUnifiedStore.getDailyAggregatedData(userId, date);

    // Aggregate meals for the day
    const meals = await this.aggregateMeals(dailyData.records);

    // Aggregate activities for the day
    const activities = await this.aggregateActivities(dailyData.records);

    // Aggregate sleep for the day
    const sleep = await this.aggregateSleep(dailyData.records);

    return {
      date: date.toISOString().split('T')[0],
      steps: dailyData.totals.steps,
      caloriesIn: dailyData.totals.caloriesConsumed,
      caloriesOut: dailyData.totals.caloriesBurned,
      netCalories: dailyData.totals.caloriesConsumed - dailyData.totals.caloriesBurned,
      sleepHours: dailyData.totals.sleepHours,
      xp: dailyData.totals.xp,
      meals,
      activities,
      sleep
    };
  }

  /**
   * Get weekly statistics
   */
  static async getWeeklyStats(userId: string, date: Date = new Date()): Promise<any> {
    const cacheKey = this.createCacheKey(userId, date, 'weekly');

    // Check if there's already an ongoing request for this user and date
    if (this.ongoingRequests.has(cacheKey)) {
      console.log('Returning ongoing request for weekly stats:', cacheKey);
      return this.ongoingRequests.get(cacheKey);
    }

    console.log('Fetching weekly stats for user:', userId, 'starting from:', date);

    // Create a new promise for this request
    const requestPromise = this.performGetWeeklyStats(userId, date)
      .finally(() => {
        // Clean up the ongoing request when it completes
        this.ongoingRequests.delete(cacheKey);
      });

    // Store the promise to prevent duplicate requests
    this.ongoingRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * Perform the actual getWeeklyStats operation
   */
  private static async performGetWeeklyStats(userId: string, date: Date): Promise<any> {
    const weekData = await ClientSafeUnifiedStore.getWeeklyAggregatedData(userId, date);

    // Generate day-by-day breakdown and chart-ready data
    const dates = [];
    const steps = [];
    const caloriesIn = [];
    const caloriesOut = [];
    const netCalories = [];
    const sleepHours = [];
    const xp = [];
    // New fields for meal + sleep insight fusion
    const nutritionScores = [];
    const sleepScores = [];
    const recoveryScores = [];
    const mealQualityTrends = [];

    const startDate = new Date(date);
    startDate.setDate(date.getDate() - date.getDay()); // Start from Sunday

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + i);

      const dailyData = await ClientSafeUnifiedStore.getDailyAggregatedData(userId, dayDate);

      const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
      dates.push(dayName);

      steps.push(dailyData.totals.steps);
      caloriesIn.push(dailyData.totals.caloriesConsumed);
      caloriesOut.push(dailyData.totals.caloriesBurned);
      netCalories.push(dailyData.totals.caloriesConsumed - dailyData.totals.caloriesBurned);
      sleepHours.push(dailyData.totals.sleepHours);
      xp.push(dailyData.totals.xp);

      // Calculate new fusion fields for each day
      const nutritionScore = this.calculateNutritionScore(dailyData.records);
      nutritionScores.push(nutritionScore);

      const sleepScore = this.calculateSleepScore(dailyData.records);
      sleepScores.push(sleepScore);

      const recoveryScore = this.calculateRecoveryScore(dailyData.totals.sleepHours, dailyData.totals.activityMinutes);
      recoveryScores.push(recoveryScore);

      const mealQualityTrend = this.calculateMealQualityTrend(dailyData.records);
      mealQualityTrends.push(mealQualityTrend);
    }

    console.log('[AGGREGATOR - WEEKLY STATS] Generated complete weekly chart data:', {
      dates: dates,
      steps: steps,
      caloriesIn: caloriesIn,
      caloriesOut: caloriesOut,
      netCalories: netCalories,
      sleepHours: sleepHours,
      xp: xp,
      // New fields
      nutritionScores: nutritionScores,
      sleepScores: sleepScores,
      recoveryScores: recoveryScores,
      mealQualityTrends: mealQualityTrends
    });

    return {
      dates,
      steps,
      caloriesIn,
      caloriesOut,
      netCalories,
      sleepHours,
      xp,
      // New fields for meal + sleep insight fusion
      nutritionScores,
      sleepScores,
      recoveryScores,
      mealQualityTrends,
      // Additional metadata
      startDate: startDate.toISOString().split('T')[0],
      endDate: new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totals: weekData.totals,
      averages: weekData.averages,
      trends: weekData.trends
    };
  }

  /**
   * Get monthly statistics
   */
  static async getMonthlyStats(userId: string, date: Date = new Date()): Promise<any> {
    const cacheKey = this.createCacheKey(userId, date, 'monthly');

    // Check if there's already an ongoing request for this user and date
    if (this.ongoingRequests.has(cacheKey)) {
      console.log('Returning ongoing request for monthly stats:', cacheKey);
      return this.ongoingRequests.get(cacheKey);
    }

    console.log('Fetching monthly stats for user:', userId, 'in month:', date.getMonth() + 1, date.getFullYear());

    // Create a new promise for this request
    const requestPromise = this.performGetMonthlyStats(userId, date)
      .finally(() => {
        // Clean up the ongoing request when it completes
        this.ongoingRequests.delete(cacheKey);
      });

    // Store the promise to prevent duplicate requests
    this.ongoingRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * Perform the actual getMonthlyStats operation
   */
  private static async performGetMonthlyStats(userId: string, date: Date): Promise<any> {
    const monthData = await ClientSafeUnifiedStore.getMonthlyAggregatedData(userId, date);

    return {
      month: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      totals: monthData.totals,
      averages: monthData.averages,
      trends: monthData.trends,
      records: monthData.records
    };
  }

  /**
   * Aggregate meal records
   */
  static async aggregateMeals(records: WellnessRecord[]): Promise<any[]> {
    console.log('Aggregating meal records:', records.filter(r => r.type === 'meal').length);

    return records
      .filter(record => record.type === 'meal')
      .map(record => ({
        id: record.id,
        timestamp: record.timestamp,
        category: record.category,
        calories: record.metrics.calories,
        quantity: record.metrics.quantity,
        nutrition: record.metrics.nutrition,
        confidence: record.metadata.confidence,
        aiInsights: record.metadata.aiInsights
      }));
  }

  /**
   * Aggregate activity records
   */
  static async aggregateActivities(records: WellnessRecord[]): Promise<any[]> {
    console.log('Aggregating activity records:', records.filter(r => r.type === 'activity').length);

    return records
      .filter(record => record.type === 'activity')
      .map(record => ({
        id: record.id,
        timestamp: record.timestamp,
        category: record.category,
        duration: record.metrics.duration,
        calories: record.metrics.calories,
        intensity: record.metrics.intensity,
        xp: record.metrics.xpEarned,
        confidence: record.metadata.confidence,
        aiInsights: record.metadata.aiInsights
      }));
  }

  /**
   * Aggregate sleep records
   */
  static async aggregateSleep(records: WellnessRecord[]): Promise<any[]> {
    console.log('Aggregating sleep records:', records.filter(r => r.type === 'sleep').length);

    return records
      .filter(record => record.type === 'sleep')
      .map(record => ({
        id: record.id,
        timestamp: record.timestamp,
        category: record.category,
        duration: record.metrics.duration, // in minutes
        quality: record.metrics.quality,
        xp: record.metrics.xpEarned,
        confidence: record.metadata.confidence,
        aiInsights: record.metadata.aiInsights
      }));
  }

  /**
   * Format today's data for the UI
   */
  private static formatTodayData(todayData: TimeAggregate) {
    return {
      date: new Date().toISOString().split('T')[0],
      steps: todayData.totals.steps,
      caloriesIn: todayData.totals.caloriesConsumed,
      caloriesOut: todayData.totals.caloriesBurned,
      netCalories: todayData.totals.caloriesConsumed - todayData.totals.caloriesBurned,
      sleepHours: todayData.totals.sleepHours,
      xp: todayData.totals.xp
    };
  }

  /**
   * Generate chart-ready data for the week
   */
  private static async generateChartData(userId: string) {
    const cacheKey = this.createCacheKey(userId, undefined, 'chart');

    // Check if there's already an ongoing request for this user
    if (this.ongoingRequests.has(cacheKey)) {
      console.log('Returning ongoing request for chart data:', cacheKey);
      return this.ongoingRequests.get(cacheKey);
    }

    console.log('[AGGREGATOR - CHART DATA] Generating chart data for user:', userId);

    // Create a new promise for this request
    const requestPromise = this.performGenerateChartData(userId)
      .finally(() => {
        // Clean up the ongoing request when it completes
        this.ongoingRequests.delete(cacheKey);
      });

    // Store the promise to prevent duplicate requests
    this.ongoingRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * Perform the actual generateChartData operation
   */
  private static async performGenerateChartData(userId: string) {
    // Get 7 days of daily aggregates
    const dates = [];
    const steps = [];
    const caloriesIn = [];
    const caloriesOut = [];
    const netCalories = [];
    const sleepHours = [];
    const xp = [];
    // New fields for meal + sleep insight fusion
    const nutritionScores = [];
    const sleepScores = [];
    const recoveryScores = [];
    const mealQualityTrends = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const dailyData = await ClientSafeUnifiedStore.getDailyAggregatedData(userId, date);
      console.log(`[AGGREGATOR - DAILY DATA] Daily data for ${date.toISOString().split('T')[0]}:`, dailyData);

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      dates.push(dayName);

      steps.push(dailyData.totals.steps);
      caloriesIn.push(dailyData.totals.caloriesConsumed);
      caloriesOut.push(dailyData.totals.caloriesBurned);
      netCalories.push(dailyData.totals.caloriesConsumed - dailyData.totals.caloriesBurned);
      sleepHours.push(dailyData.totals.sleepHours);
      xp.push(dailyData.totals.xp);

      // Calculate new fields for meal + sleep insight fusion
      // Nutrition score based on calories consumed and nutritional variety (if available)
      const nutritionScore = this.calculateNutritionScore(dailyData.records);
      nutritionScores.push(nutritionScore);

      // Sleep score based on hours and quality (if available)
      const sleepScore = this.calculateSleepScore(dailyData.records);
      sleepScores.push(sleepScore);

      // Recovery score based on sleep and activity balance
      const recoveryScore = this.calculateRecoveryScore(dailyData.totals.sleepHours, dailyData.totals.activityMinutes);
      recoveryScores.push(recoveryScore);

      // Meal quality trend based on meal frequency and variety
      const mealQualityTrend = this.calculateMealQualityTrend(dailyData.records);
      mealQualityTrends.push(mealQualityTrend);
    }

    console.log('[AGGREGATOR - CHART DATA] Generated chart data:', {
      dates: dates,
      steps: steps,
      caloriesIn: caloriesIn,
      caloriesOut: caloriesOut,
      netCalories: netCalories,
      sleepHours: sleepHours,
      xp: xp,
      // New fields
      nutritionScores: nutritionScores,
      sleepScores: sleepScores,
      recoveryScores: recoveryScores,
      mealQualityTrends: mealQualityTrends
    });

    return {
      dates,
      steps,
      caloriesIn,
      caloriesOut,
      netCalories,
      sleepHours,
      xp,
      // New fields for meal + sleep insight fusion
      nutritionScores,
      sleepScores,
      recoveryScores,
      mealQualityTrends
    };
  }

  /**
   * Calculate nutrition score based on daily records
   */
  private static calculateNutritionScore(records: any[]): number {
    // Get all meal records for the day
    const meals = records.filter(r => r.type === 'meal');

    if (meals.length === 0) {
      return 0;
    }

    // Calculate score based on meal variety and nutritional content
    let score = 0;

    // Meal frequency score (3 meals = full points)
    const mealCountScore = Math.min(100, (meals.length / 3) * 100);
    score += mealCountScore * 0.3; // 30% weight

    // Calorie adequacy score (based on a reasonable range)
    const totalCalories = meals.reduce((sum, meal) => sum + (meal.metrics.calories || 0), 0);
    if (totalCalories >= 1200 && totalCalories <= 3000) {
      score += 30; // 30% weight for appropriate calorie range
    } else if (totalCalories > 0) {
      // Partial points for being in range
      const calorieRatio = Math.min(totalCalories / 1200, 3000 / totalCalories);
      score += Math.min(30, calorieRatio * 30);
    }

    // Nutrition content score (if available)
    const nutritionContentScore = meals.reduce((sum, meal) => {
      if (meal.metrics.nutrition && Object.keys(meal.metrics.nutrition).length > 0) {
        return sum + 10; // Points for having nutrition data
      }
      return sum;
    }, 0) / meals.length; // Average across meals

    score += nutritionContentScore * 0.4; // 40% weight for nutrition content

    return Math.min(100, score);
  }

  /**
   * Calculate sleep score based on daily records
   */
  private static calculateSleepScore(records: any[]): number {
    // Get all sleep records for the day
    const sleepRecords = records.filter(r => r.type === 'sleep');

    if (sleepRecords.length === 0) {
      return 0;
    }

    // Calculate score based on sleep duration and quality
    let score = 0;

    // Average sleep duration across records (if multiple)
    const totalSleepMinutes = sleepRecords.reduce((sum, sleep) => sum + (sleep.metrics.duration || 0), 0);
    const avgSleepHours = (totalSleepMinutes / sleepRecords.length) / 60;

    // Duration score (optimal 7-9 hours)
    if (avgSleepHours >= 7 && avgSleepHours <= 9) {
      score += 70; // 70% weight for duration
    } else if (avgSleepHours > 5 && avgSleepHours < 7) {
      score += (avgSleepHours - 5) * 17.5; // Proportional scoring
    } else if (avgSleepHours > 9 && avgSleepHours < 11) {
      score += (11 - avgSleepHours) * 17.5; // Proportional scoring for too much sleep
    }

    // Quality score (if available, 0-1 scale)
    const avgQuality = sleepRecords.reduce((sum, sleep) => sum + (sleep.metrics.quality || 0), 0) / sleepRecords.length;
    score += avgQuality * 30; // 30% weight for quality

    return Math.min(100, score);
  }

  /**
   * Calculate recovery score based on sleep and activity
   */
  private static calculateRecoveryScore(sleepHours: number, activityMinutes: number): number {
    // Recovery score based on balance between activity and recovery
    // Optimal is 7-9 hours sleep per day with regular activity

    let score = 0;

    // Sleep component (60% of recovery score)
    if (sleepHours >= 7 && sleepHours <= 9) {
      score += 60; // Full points for optimal sleep
    } else if (sleepHours > 5 && sleepHours < 7) {
      score += (sleepHours - 5) * 15; // Proportional scoring (15 points per hour in range)
    } else if (sleepHours > 9 && sleepHours < 11) {
      score += (11 - sleepHours) * 15; // Proportional scoring for too much sleep
    }

    // Activity-recovery balance component (40% of recovery score)
    // More activity requires more recovery, so higher sleep is beneficial
    if (activityMinutes > 0) {
      // More active people need more sleep, so we adjust the optimal range
      const activityLevel = Math.min(1, activityMinutes / 120); // Normalize activity (2 hours max for normalization)

      // Check if sleep is appropriate for activity level
      if (sleepHours >= 7 + (activityLevel * 0.5) && sleepHours <= 9 + (activityLevel * 0.5)) {
        score += 40; // Full points for appropriate recovery
      } else {
        // Partial points based on how close to optimal
        const sleepRatio = sleepHours / (7 + (activityLevel * 0.5));
        score += Math.min(40, sleepRatio * 40);
      }
    } else {
      // No activity but some sleep is still good for recovery
      score += 10; // Minimum points for basic rest
    }

    return Math.min(100, score);
  }

  /**
   * Calculate meal quality trend
   */
  private static calculateMealQualityTrend(records: any[]): number {
    // Get all meal records for the day
    const meals = records.filter(r => r.type === 'meal');

    if (meals.length === 0) {
      return 0;
    }

    // Calculate quality based on variety and nutritional content
    let qualityScore = 0;

    // Meal variety score
    const uniqueCategories = new Set(meals.map(meal => meal.category)).size;
    qualityScore += (uniqueCategories / 5) * 40; // Up to 40 points for variety

    // Nutrition content score
    const nutritionContentScore = meals.reduce((sum, meal) => {
      if (meal.metrics.nutrition && Object.keys(meal.metrics.nutrition).length > 0) {
        return sum + 20; // Points for having nutrition data
      }
      return sum;
    }, 0) / meals.length; // Average across meals

    qualityScore += nutritionContentScore;

    // Calorie distribution score (even distribution is better than one large meal)
    if (meals.length > 1) {
      const calories = meals.map(meal => meal.metrics.calories || 0);
      const avgCalories = calories.reduce((sum, cal) => sum + cal, 0) / calories.length;

      // Measure how evenly distributed calories are
      const variance = calories.reduce((sum, cal) => sum + Math.pow(cal - avgCalories, 2), 0) / calories.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = avgCalories > 0 ? stdDev / avgCalories : 1;

      // Lower variation = higher score
      const distributionScore = Math.max(0, (1 - coefficientOfVariation) * 40);
      qualityScore += distributionScore;
    } else {
      // Penalty for only one meal
      qualityScore *= 0.5;
    }

    return Math.min(100, qualityScore);
  }

  /**
   * Get recent records grouped by type
   */
  private static async getRecentRecords(userId: string) {
    // Get the last 30 days of data to find recent records
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const records = await ClientSafeUnifiedStore.getRecordsForPeriod(userId, startDate, endDate);

    // Sort records by timestamp (descending)
    const sortedRecords = records.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Group and limit to recent records
    const activities = sortedRecords
      .filter(record => record.type === 'activity')
      .slice(0, 5);

    const meals = sortedRecords
      .filter(record => record.type === 'meal')
      .slice(0, 5);

    const sleep = sortedRecords
      .filter(record => record.type === 'sleep')
      .slice(0, 5);

    return {
      activities,
      meals,
      sleep
    };
  }

  /**
   * Get summary statistics for AI insights
   */
  static async getSummaryStats(userId: string) {
    const cacheKey = this.createCacheKey(userId, undefined, 'summary');

    // Check if there's already an ongoing request for this user
    if (this.ongoingRequests.has(cacheKey)) {
      console.log('Returning ongoing request for summary stats:', cacheKey);
      return this.ongoingRequests.get(cacheKey);
    }

    // Create a new promise for this request
    const requestPromise = this.performGetSummaryStats(userId)
      .finally(() => {
        // Clean up the ongoing request when it completes
        this.ongoingRequests.delete(cacheKey);
      });

    // Store the promise to prevent duplicate requests
    this.ongoingRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * Perform the actual getSummaryStats operation
   */
  private static async performGetSummaryStats(userId: string) {
    try {
      const insights = await this.getInsightsData(userId);

      // Safely calculate week totals with fallbacks
      const weekStepsTotal = Array.isArray(insights?.week?.steps)
        ? insights.week.steps.reduce((sum, val) => (sum + (val || 0)), 0)
        : 0;
      const weekCaloriesInTotal = Array.isArray(insights?.week?.caloriesIn)
        ? insights.week.caloriesIn.reduce((sum, val) => (sum + (val || 0)), 0)
        : 0;
      const weekCaloriesOutTotal = Array.isArray(insights?.week?.caloriesOut)
        ? insights.week.caloriesOut.reduce((sum, val) => (sum + (val || 0)), 0)
        : 0;
      const weekNetCaloriesTotal = weekCaloriesInTotal - weekCaloriesOutTotal;
      const weekSleepTotal = Array.isArray(insights?.week?.sleepHours)
        ? insights.week.sleepHours.reduce((sum, val) => (sum + (val || 0)), 0)
        : 0;
      const weekXPTotal = Array.isArray(insights?.week?.xp)
        ? insights.week.xp.reduce((sum, val) => (sum + (val || 0)), 0)
        : 0;

      // Get goal information for context
      const { GoalsStorage } = await import('@/lib/storage/goals-storage');
      const todaysGoals = await GoalsStorage.getTodaysGoals(userId);

      return {
        week: {
          stepsTotal: weekStepsTotal,
          caloriesInTotal: weekCaloriesInTotal,
          caloriesOutTotal: weekCaloriesOutTotal,
          netCaloriesTotal: weekNetCaloriesTotal,
          sleepTotal: weekSleepTotal,
          xpTotal: weekXPTotal
        },
        today: {
          ...insights?.today,
          goals: todaysGoals?.goals || null
        }
      };
    } catch (error) {
      console.error('[UNIFIED AGGREGATOR] Error in getSummaryStats:', error);
      // Return default values in case of error
      return {
        week: {
          stepsTotal: 0,
          caloriesInTotal: 0,
          caloriesOutTotal: 0,
          netCaloriesTotal: 0,
          sleepTotal: 0,
          xpTotal: 0
        },
        today: {
          date: new Date().toISOString().split('T')[0],
          steps: 0,
          caloriesIn: 0,
          caloriesOut: 0,
          netCalories: 0,
          sleepHours: 0,
          xp: 0,
          goals: null
        }
      };
    }
  }

  /**
   * Get adaptive goals for a user
   */
  static async getAdaptiveGoals(userId: string, date: Date = new Date()) {
    const { GoalsStorage } = await import('@/lib/storage/goals-storage');
    return await GoalsStorage.getGoalsForDate(userId, date);
  }
}

export default ClientSafeUnifiedAggregator;