import ClientSafeUnifiedStore from '@/lib/storage/client-safe-unified-store';
import { getWeeklyStats } from '@/lib/storage/unified-aggregator-wrapper';

interface StreakData {
  stepsStreak: number;
  sleepStreak: number;
}

/**
 * XP system that integrates with the unified storage system
 * Ensures all XP is tracked through a single storage source
 */
class XpSystem {
  /**
   * Calculate any active XP bonuses for the user
   */
  static async calculateXpBonus(userId: string): Promise<number> {
    try {
      // Get recent data to calculate streaks
      const weeklyStats = await getWeeklyStats(userId);

      if (!Array.isArray(weeklyStats?.sleepHours) || !Array.isArray(weeklyStats?.steps)) {
        return 1.0; // No bonus if no data
      }

      // Get last 3 days of data for streak checks
      const recentSteps = weeklyStats.steps?.slice(-3) || [];
      const recentSleep = weeklyStats.sleepHours?.slice(-3) || [];

      let xpMultiplier = 1.0;

      // Streak bonus 1: If user has 3-day streak (steps > 6000 OR caloriesOut > caloriesIn + buffer)
      const stepsStreak = recentSteps.length === 3 && recentSteps.every(steps => (steps || 0) > 6000);

      // For calories: caloriesOut significantly greater than caloriesIn (indicating activity)
      const recentCaloriesIn = weeklyStats.caloriesIn?.slice(-3) || [];
      const recentCaloriesOut = weeklyStats.caloriesOut?.slice(-3) || [];

      let caloriesStreak = false;
      if (recentCaloriesIn.length > 0 && recentCaloriesOut.length > 0 &&
          recentCaloriesIn.length === recentCaloriesOut.length) {
        // Check if calories burned is consistently greater than calories consumed
        caloriesStreak = recentCaloriesIn.every((inCalorie, idx) => {
          const outCal = recentCaloriesOut[idx] || 0;
          const inCal = inCalorie || 0;
          // If calories out is significantly greater than calories in (by at least 100 cal)
          return outCal > (inCal + 100);
        });
      }

      if (stepsStreak) {
        xpMultiplier += 0.1; // +10% bonus for 3-day steps streak
      } else if (caloriesStreak) {
        xpMultiplier += 0.1; // +10% bonus for 3-day calorie burn streak
      }

      // Streak bonus 2: If sleep streak ≥ 3 days (sleepHours > 7)
      const sleepStreak = recentSleep.length === 3 &&
                          recentSleep.every(hours => (hours || 0) > 7);

      if (sleepStreak) {
        xpMultiplier += 0.1; // +10% bonus for 3-day sleep streak
      }

      console.log(`[XP SYSTEM] Calculated bonus multiplier for ${userId}: ${xpMultiplier}`);
      return xpMultiplier;
    } catch (error) {
      console.error('[XP SYSTEM] Error calculating XP bonus:', error);
      return 1.0; // Default to no bonus if there's an error
    }
  }

  /**
   * Add XP to user's total using unified storage with potential bonus
   */
  static async addXP(userId: string, xpAmount: number, activityType?: string): Promise<number> {
    console.log(`Adding ${xpAmount} XP for user ${userId} from ${activityType || 'unknown activity'}`);

    // Calculate any applicable bonuses
    const bonusMultiplier = await this.calculateXpBonus(userId);
    const bonusXP = Math.floor(xpAmount * bonusMultiplier);

    console.log(`[XP SYSTEM] Base XP: ${xpAmount}, Multiplier: ${bonusMultiplier}, Total XP: ${bonusXP}`);

    return await ClientSafeUnifiedStore.addXP(userId, bonusXP);
  }

  /**
   * Get user's total XP from unified storage
   */
  static async getXp(userId: string): Promise<number> {
    return await ClientSafeUnifiedStore.getXp(userId);
  }

  /**
   * Calculate user's level based on XP
   */
  static calculateLevel(xp: number): number {
    // Simple level calculation: level = floor(sqrt(totalXP / 100)) + 1
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  /**
   * Get user's current level
   */
  static async getLevel(userId: string): Promise<number> {
    const xp = await this.getXp(userId);
    return this.calculateLevel(xp);
  }
}

export default XpSystem;