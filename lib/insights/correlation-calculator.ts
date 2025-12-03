import { WellnessRecord } from '@/data/models/wellness-record';
import { CorrelationResult } from './fusion-engine';

/**
 * Correlation Calculator
 * Performs statistical analysis to find relationships between different wellness metrics
 */
export class CorrelationCalculator {
  /**
   * Calculate correlation between meal timing and sleep quality
   */
  calculateMealSleepTimingCorrelation(meals: WellnessRecord[], sleepData: WellnessRecord[]): CorrelationResult {
    console.log(`[CORRELATION CALCULATOR] Calculating meal-sleep timing correlation for ${meals.length} meals and ${sleepData.length} sleep records`);

    // Get meal timestamps and sleep quality metrics
    const mealData: { timestamp: number; timeOfDay: number; }[] = [];
    const sleepDataWithTime: { sleepTimestamp: number; quality: number; bedtime: number }[] = [];

    // Process meals - get timing (hours of day)
    meals.forEach(meal => {
      const mealDate = new Date(meal.timestamp);
      mealData.push({
        timestamp: mealDate.getTime(),
        timeOfDay: mealDate.getHours() + mealDate.getMinutes() / 60 // Convert to decimal hours
      });
    });

    // Process sleep records - get quality and bedtime
    sleepData.forEach(sleep => {
      const sleepDate = new Date(sleep.timestamp);
      const bedtime = sleepDate.getHours() + sleepDate.getMinutes() / 60;
      
      sleepDataWithTime.push({
        sleepTimestamp: sleepDate.getTime(),
        quality: sleep.metrics.quality || 0,
        bedtime
      });
    });

    if (mealData.length === 0 || sleepDataWithTime.length === 0) {
      return {
        correlation: 0,
        pValue: 1,
        significance: 'low',
        description: 'Insufficient data to calculate correlation'
      };
    }

    // Find meals and sleep sessions that are temporally related
    // For this, we'll look at meal timing on the day of sleep
    const relatedData: { mealTime: number; sleepQuality: number }[] = [];
    
    sleepDataWithTime.forEach(sleep => {
      const sleepDate = new Date(sleep.sleepTimestamp);
      
      // Get meals from the same day (or the day before in case of late eating)
      const sameDayMeals = mealData.filter(meal => {
        const mealDate = new Date(meal.timestamp);
        return mealDate.toDateString() === sleepDate.toDateString();
      });

      // If no same day meals, try previous day meals for late evening sleep
      const mealsToUse = sameDayMeals.length > 0 ? sameDayMeals : 
        mealData.filter(meal => {
          const mealDate = new Date(meal.timestamp);
          const prevDay = new Date(sleepDate);
          prevDay.setDate(sleepDate.getDate() - 1);
          return mealDate.toDateString() === prevDay.toDateString();
        });

      if (mealsToUse.length > 0) {
        // Use the last meal of the day as the key timing factor
        const lastMeal = mealsToUse.reduce((latest, current) => 
          current.timeOfDay > latest.timeOfDay ? current : latest
        );
        
        relatedData.push({
          mealTime: lastMeal.timeOfDay,
          sleepQuality: sleep.quality
        });
      }
    });

    if (relatedData.length < 3) {
      return {
        correlation: 0,
        pValue: 1,
        significance: 'low',
        description: 'Insufficient related data points to calculate correlation'
      };
    }

    // Calculate Pearson correlation coefficient
    const correlation = this.calculatePearsonCorrelation(
      relatedData.map(d => d.mealTime),
      relatedData.map(d => d.sleepQuality)
    );

    // Calculate p-value (simplified)
    const n = relatedData.length;
    const tStatistic = Math.abs(correlation) * Math.sqrt((n - 2) / (1 - correlation * correlation));
    const pValue = this.calculatePValue(tStatistic, n - 2);

    // Determine significance
    let significance: 'high' | 'medium' | 'low' = 'low';
    if (pValue < 0.01) {
      significance = 'high';
    } else if (pValue < 0.05) {
      significance = 'medium';
    }

    const description = correlation < -0.3 
      ? `Late meal timing is associated with poorer sleep quality (r=${correlation.toFixed(2)})` 
      : correlation > 0.3
      ? `Meal timing is positively associated with sleep quality (r=${correlation.toFixed(2)})`
      : `Meal timing has a neutral association with sleep quality (r=${correlation.toFixed(2)})`;

    return {
      correlation,
      pValue,
      significance,
      description
    };
  }

  /**
   * Calculate correlation between nutrition quality and sleep quality
   */
  calculateNutritionSleepQualityCorrelation(meals: WellnessRecord[], sleepData: WellnessRecord[]): CorrelationResult {
    console.log(`[CORRELATION CALCULATOR] Calculating nutrition-sleep quality correlation for ${meals.length} meals and ${sleepData.length} sleep records`);

    // For this calculation, we need to determine nutrition quality from meals
    // We'll use a simple metric based on calories and available nutrition data
    const mealNutritionData: { calories: number; qualityIndex: number; }[] = [];
    const sleepQualityData: number[] = [];

    // Group meals by date for nutrition quality calculation
    const mealsByDate: { [date: string]: WellnessRecord[] } = {};
    meals.forEach(meal => {
      const date = new Date(meal.timestamp).toDateString();
      if (!mealsByDate[date]) {
        mealsByDate[date] = [];
      }
      mealsByDate[date].push(meal);
    });

    // Calculate nutrition quality for each day
    Object.entries(mealsByDate).forEach(([date, dayMeals]) => {
      // Calculate daily nutrition quality index
      // This could be based on protein/fat/carb ratios, micronutrients, etc.
      // For now, we'll use a simplified approach based on calorie distribution and nutrition field
      const totalCalories = dayMeals.reduce((sum, meal) => sum + (meal.metrics.calories || 0), 0);
      
      // If we have detailed nutrition data, we can improve this calculation
      let qualityIndex = 0;
      if (dayMeals.length >= 3) { // Had at least 3 meals (breakfast, lunch, dinner)
        qualityIndex += 20; // Points for meal regularity
      }
      
      if (totalCalories > 1200 && totalCalories < 3000) {
        qualityIndex += 20; // Points for within healthy calorie range
      }
      
      // Add points based on nutrition field (if available)
      dayMeals.forEach(meal => {
        if (meal.metrics.nutrition && Object.keys(meal.metrics.nutrition).length > 0) {
          qualityIndex += 10; // Points for having nutrition data
        }
      });
      
      // Normalize to 0-100 scale
      qualityIndex = Math.min(100, qualityIndex);
      
      mealNutritionData.push({
        calories: totalCalories,
        qualityIndex
      });
    });

    // Group sleep data by date
    const sleepByDate: { [date: string]: WellnessRecord[] } = {};
    sleepData.forEach(sleep => {
      const date = new Date(sleep.timestamp).toDateString();
      if (!sleepByDate[date]) {
        sleepByDate[date] = [];
      }
      sleepByDate[date].push(sleep);
    });

    // Match nutrition data with sleep data by date
    const matchingDays: { nutritionQuality: number; sleepQuality: number }[] = [];
    
    Object.entries(mealsByDate).forEach(([date, dayMeals]) => {
      if (sleepByDate[date]) {
        // Calculate average sleep quality for the night of this date
        const avgSleepQuality = sleepByDate[date].reduce((sum, sleep) => sum + (sleep.metrics.quality || 0), 0) / sleepByDate[date].length;
        const nutritionQuality = mealNutritionData.find(nd => 
          dayMeals.some(dm => new Date(dm.timestamp).toDateString() === date)
        )?.qualityIndex || 0;
        
        matchingDays.push({
          nutritionQuality,
          sleepQuality: avgSleepQuality
        });
      }
    });

    if (matchingDays.length < 3) {
      return {
        correlation: 0,
        pValue: 1,
        significance: 'low',
        description: 'Insufficient matching days to calculate correlation'
      };
    }

    // Calculate Pearson correlation coefficient
    const correlation = this.calculatePearsonCorrelation(
      matchingDays.map(d => d.nutritionQuality),
      matchingDays.map(d => d.sleepQuality)
    );

    // Calculate p-value (simplified)
    const n = matchingDays.length;
    const tStatistic = Math.abs(correlation) * Math.sqrt((n - 2) / (1 - correlation * correlation));
    const pValue = this.calculatePValue(tStatistic, n - 2);

    // Determine significance
    let significance: 'high' | 'medium' | 'low' = 'low';
    if (pValue < 0.01) {
      significance = 'high';
    } else if (pValue < 0.05) {
      significance = 'medium';
    }

    const description = correlation < -0.3 
      ? `Poorer nutrition quality is associated with poorer sleep quality (r=${correlation.toFixed(2)})` 
      : correlation > 0.3
      ? `Better nutrition quality is associated with better sleep quality (r=${correlation.toFixed(2)})`
      : `Nutrition quality has a neutral association with sleep quality (r=${correlation.toFixed(2)})`;

    return {
      correlation,
      pValue,
      significance,
      description
    };
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) {
      return 0;
    }

    const n = x.length;

    // Calculate means
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;

    // Calculate numerator and denominators for correlation
    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      
      numerator += diffX * diffY;
      sumSqX += diffX * diffX;
      sumSqY += diffY * diffY;
    }

    // Calculate correlation coefficient
    const denominator = Math.sqrt(sumSqX * sumSqY);
    
    if (denominator === 0) {
      return 0; // No variance in one or both variables
    }

    return numerator / denominator;
  }

  /**
   * Calculate p-value for correlation (simplified)
   */
  private calculatePValue(tStatistic: number, degreesOfFreedom: number): number {
    // This is a simplified calculation - in reality, you'd use a more complex statistical function
    // For now, use an approximation
    if (degreesOfFreedom <= 0) {
      return 1;
    }

    // Using the t-distribution CDF approximation (simplified)
    // This is a very rough approximation for demonstration purposes
    const approxP = 2 * (1 - this.studentTCDF(Math.abs(tStatistic), degreesOfFreedom));
    return Math.min(1, Math.max(0, approxP));
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    // Approximation using the method of Abramowitz and Stegun
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    // A&S formula 7.1.26
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Approximate Student's t-distribution CDF
   */
  private studentTCDF(t: number, df: number): number {
    // Simplified approximation of the Student's t-distribution CDF
    // This is a very basic approximation for demonstration purposes
    if (df === 1) {
      // Cauchy distribution (t with df=1)
      return 0.5 + Math.atan(t) / Math.PI;
    } else if (df < 30) {
      // For small df, use basic approximation
      const x = t / Math.sqrt(df);
      return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
    } else {
      // For large df, approximate with normal distribution
      return 0.5 * (1 + this.erf(t / Math.sqrt(2)));
    }
  }

  /**
   * Find optimal meal timing based on sleep patterns
   */
  findOptimalMealTiming(sleepPatterns: any[]): { dinnerTime: string; confidence: number } {
    // This method would analyze historical meal and sleep data to determine optimal timing
    // For now, we'll return a basic recommendation
    return {
      dinnerTime: '19:00',
      confidence: 0.6
    };
  }
}