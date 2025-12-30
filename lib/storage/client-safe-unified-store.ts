import { WellnessRecord, TimeAggregate } from '@/data/models/wellness-record';

/**
 * Client-safe unified data storage system that can be used on both client and server
 * Uses localStorage on the client, integrates with server storage when authenticated
 */
class ClientSafeUnifiedStore {
  private static readonly BASE_KEY = 'fitsync_unified';
  private static readonly XP_KEY = (userId: string) => `${this.BASE_KEY}_xp_${userId}`;
  private static readonly RECORDS_KEY = (userId: string) => `${this.BASE_KEY}_records_${userId}`;

  // Legacy keys for backward compatibility
  private static readonly LEGACY_ACTIVITY_KEY = (userId: string) => `activities_${userId}`;
  private static readonly LEGACY_MEAL_KEY = (userId: string) => `meals_${userId}`;
  private static readonly LEGACY_SLEEP_KEY_PREFIX = (userId: string) => `sleep_${userId}_`;
  private static readonly LEGACY_XP_KEY = () => `fitsync-xp`; // XP is shared, not per user

  /**
   * Check if running on client side
   */
  private static isClientSide(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  /**
   * Get localStorage safely
   */
  private static getLocalStorage(): Storage | null {
    return this.isClientSide() ? window.localStorage : null;
  }

  /**
   * Add a new wellness record to the unified store
   */
  static async addRecord(userId: string, record: Omit<WellnessRecord, 'id'>): Promise<WellnessRecord> {
    console.log('Adding wellness record:', record);

    // Normalize the record
    const normalizedRecord: WellnessRecord = {
      ...record,
      id: this.generateId(),
    };

    // Get existing records
    const records = await this.getAllRecords(userId);

    // Add new record
    records.push(normalizedRecord);

    // Store updated records using appropriate storage
    if (this.isClientSide()) {
      const localStorage = this.getLocalStorage();
      if (localStorage) {
        localStorage.setItem(
          this.RECORDS_KEY(userId),
          JSON.stringify(records)
        );
      }
    } else {
      // On server, potentially use database or filesystem storage
      console.warn('Server-side storage not implemented, record not persisted');
    }

    // Try to sync with server if available
    await this.syncWithServer(userId, normalizedRecord);

    // Update XP if the record includes XP (only on client for now)
    if (this.isClientSide() && record.metrics.xpEarned && record.metrics.xpEarned > 0) {
      await this.addXP(userId, record.metrics.xpEarned);
    }

    console.log('Record added successfully, total records:', records.length);
    return normalizedRecord;
  }

  /**
   * Sync record with server storage
   */
  private static async syncWithServer(userId: string, record: WellnessRecord): Promise<void> {
    if (!this.isClientSide()) return;

    try {
      // Check if user is authenticated
      const session = await this.getSession();
      if (!session) {
        console.log('No active session, skipping server sync');
        return;
      }

      // Send record to server
      const response = await fetch(`/api/storage/${userId}/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });

      if (!response.ok) {
        console.warn('Failed to sync record with server:', await response.text());
      } else {
        console.log('Record synced with server successfully');
      }
    } catch (error) {
      console.warn('Error syncing with server:', error);
    }
  }

  /**
   * Get all wellness records for a user
   * This function is smart - it will try multiple userId formats to find data
   */
  static async getAllRecords(userId: string): Promise<WellnessRecord[]> {
    if (this.isClientSide()) {
      const localStorage = this.getLocalStorage();
      if (!localStorage) {
        return [];
      }

      // Try to get records with the provided userId first
      let stored = localStorage.getItem(this.RECORDS_KEY(userId));

      // If not found, try alternative userId formats (for backward compatibility)
      const alternativeUserIds = this.getAlternativeUserIds(userId);
      if (!stored) {
        for (const altUserId of alternativeUserIds) {
          stored = localStorage.getItem(this.RECORDS_KEY(altUserId));
          if (stored) {
            console.log(`[UNIFIED STORE] Found records with alternative userId format: ${altUserId}`);
            // Merge this data into the main userId's storage for future consistency
            try {
              const altRecords = JSON.parse(stored);
              if (altRecords.length > 0) {
                // Store with the current userId format for consistency
                localStorage.setItem(this.RECORDS_KEY(userId), JSON.stringify(altRecords));
              }
            } catch (e) {
              console.error('Error merging alternative userId records:', e);
            }
            break;
          }
        }
      }

      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (error) {
          console.error('Error parsing records:', error);
          return [];
        }
      }

      // Try to migrate from legacy storage if no unified records exist
      const legacyRecords = await this.migrateFromLegacy(userId);

      // Also try migrating with alternative userIds
      if (legacyRecords.length === 0) {
        for (const altUserId of alternativeUserIds) {
          const altLegacyRecords = await this.migrateFromLegacy(altUserId);
          if (altLegacyRecords.length > 0) {
            console.log(`[UNIFIED STORE] Migrated ${altLegacyRecords.length} records from alternative userId: ${altUserId}`);
            // Store with the current userId format
            localStorage.setItem(this.RECORDS_KEY(userId), JSON.stringify(altLegacyRecords));
            return altLegacyRecords;
          }
        }
      }

      return legacyRecords;
    } else {
      // Server-side implementation - return empty array or fetch from database
      console.warn('Server-side storage not implemented, returning empty records');
      return [];
    }
  }

  /**
   * Get alternative userId formats to try when looking for user data
   * This helps with backward compatibility when userId format changes
   */
  private static getAlternativeUserIds(userId: string): string[] {
    const alternatives: string[] = [];

    // If userId looks like an email, try using just the username part
    if (userId.includes('@')) {
      const usernamePart = userId.split('@')[0];
      alternatives.push(usernamePart);
    }

    // If userId doesn't look like an email, try adding common email domains
    if (!userId.includes('@')) {
      alternatives.push(`${userId}@example.com`);
    }

    return alternatives;
  }

  /**
   * Get records for a specific time period
   */
  static async getRecordsForPeriod(userId: string, startDate: Date, endDate: Date): Promise<WellnessRecord[]> {
    const allRecords = await this.getAllRecords(userId);

    // Convert dates to timestamps for comparison
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    return allRecords.filter(record => {
      const recordDate = new Date(record.timestamp).getTime();
      return recordDate >= startTimestamp && recordDate <= endTimestamp;
    });
  }

  /**
   * Get daily aggregated data
   */
  static async getDailyAggregatedData(userId: string, date: Date = new Date()): Promise<TimeAggregate> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const records = await this.getRecordsForPeriod(userId, startOfDay, endOfDay);

    return this.calculateTimeAggregate('daily', startOfDay, endOfDay, records);
  }

  /**
   * Get weekly aggregated data
   */
  static async getWeeklyAggregatedData(userId: string, date: Date = new Date()): Promise<TimeAggregate> {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Start from Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const records = await this.getRecordsForPeriod(userId, startOfWeek, endOfWeek);

    return this.calculateTimeAggregate('weekly', startOfWeek, endOfWeek, records);
  }

  /**
   * Get monthly aggregated data
   */
  static async getMonthlyAggregatedData(userId: string, date: Date = new Date()): Promise<TimeAggregate> {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const records = await this.getRecordsForPeriod(userId, startOfMonth, endOfMonth);

    return this.calculateTimeAggregate('monthly', startOfMonth, endOfMonth, records);
  }

  /**
   * Calculate time aggregate from records
   */
  private static calculateTimeAggregate(
    period: 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date,
    records: WellnessRecord[]
  ): TimeAggregate {
    console.log(`[UNIFIED STORE - CALCULATE AGGREGATE] Processing ${records.length} records for ${period} period`);

    // Calculate totals
    const totals = records.reduce((acc, record) => {
      console.log(`[UNIFIED STORE - RECORD PROCESSING] Processing record:`, {
        id: record.id,
        type: record.type,
        calories: record.metrics.calories,
        xp: record.metrics.xpEarned
      });

      acc.xp += record.metrics.xpEarned || 0;
      acc.activityMinutes += record.metrics.duration || 0;
      acc.steps += record.metrics.quantity || 0;

      // Handle calories based on record type
      if (record.type === 'meal') {
        acc.caloriesConsumed += record.metrics.calories || 0;
        console.log(`[UNIFIED STORE - CALORIES] Added ${record.metrics.calories || 0} to caloriesConsumed for meal`);
      } else if (record.type === 'activity') {
        acc.caloriesBurned += record.metrics.calories || 0;
        console.log(`[UNIFIED STORE - CALORIES] Added ${record.metrics.calories || 0} to caloriesBurned for activity`);
      }

      // Handle sleep hours
      if (record.type === 'sleep') {
        acc.sleepHours += (record.metrics.duration || 0) / 60; // Convert minutes to hours
        console.log(`[UNIFIED STORE - SLEEP] Added ${(record.metrics.duration || 0) / 60} hours to sleep for sleep record`);
      }

      return acc;
    }, {
      xp: 0,
      caloriesBurned: 0,
      caloriesConsumed: 0,
      activityMinutes: 0,
      sleepHours: 0,
      steps: 0
    });

    console.log(`[UNIFIED STORE - AGGREGATE RESULTS] Totals for ${period}:`, totals);

    // Calculate averages
    const averages = {
      sleepQuality: records
        .filter(r => r.type === 'sleep')
        .reduce((sum, r) => sum + (r.metrics.quality || 0), 0) /
        (records.filter(r => r.type === 'sleep').length || 1),
      activityIntensity: records
        .filter(r => r.type === 'activity')
        .reduce((sum, r) => sum + (r.metrics.intensity || 0), 0) /
        (records.filter(r => r.type === 'activity').length || 1),
      nutritionBalance: 0 // Calculate based on protein/carb/fat ratios when available
    };

    return {
      period,
      startDate,
      endDate,
      totals,
      averages,
      trends: {
        xpTrend: 0, // Would calculate based on historical data
        calorieBalanceTrend: 0, // Would calculate based on historical data
        consistencyScore: 0 // Would calculate based on consistency of logging
      },
      records
    };
  }

  /**
   * Add XP to user's total
   */
  static async addXP(userId: string, xpAmount: number): Promise<number> {
    if (this.isClientSide()) {
      const localStorage = this.getLocalStorage();
      if (localStorage) {
        const currentXP = await this.getXp(userId);
        const newXP = currentXP + xpAmount;

        localStorage.setItem(this.XP_KEY(userId), newXP.toString());
        console.log(`Added ${xpAmount} XP to user ${userId}, total is now: ${newXP}`);

        return newXP;
      }
    }

    console.warn('Server-side XP storage not implemented');
    return 0;
  }

  /**
   * Get user's total XP
   */
  static async getXp(userId: string): Promise<number> {
    if (this.isClientSide()) {
      const localStorage = this.getLocalStorage();
      if (localStorage) {
        const xpString = localStorage.getItem(this.XP_KEY(userId));
        return xpString ? parseInt(xpString, 10) : 0;
      }
    }

    console.warn('Server-side XP retrieval not implemented');
    return 0;
  }

  /**
   * Generate a unique ID for records
   */
  private static generateId(): string {
    return `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Migrate data from legacy storage systems to unified storage
   */
  private static async migrateFromLegacy(userId: string): Promise<WellnessRecord[]> {
    console.log('Migrating legacy data for user:', userId);

    if (!this.isClientSide()) {
      console.warn('Legacy migration not supported on server');
      return [];
    }

    const localStorage = this.getLocalStorage();
    if (!localStorage) {
      return [];
    }

    let allRecords: WellnessRecord[] = [];

    // Migrate activities
    const legacyActivities = localStorage.getItem(this.LEGACY_ACTIVITY_KEY(userId));
    if (legacyActivities) {
      try {
        const activities = JSON.parse(legacyActivities);
        const activityRecords = activities.map(activity => this.migrateActivityToRecord(activity, userId));
        allRecords = [...allRecords, ...activityRecords];
      } catch (e) {
        console.error('Error migrating activities:', e);
      }
    }

    // Migrate meals
    const legacyMeals = localStorage.getItem(this.LEGACY_MEAL_KEY(userId));
    if (legacyMeals) {
      try {
        const meals = JSON.parse(legacyMeals);
        const mealRecords = meals.map(meal => this.migrateMealToRecord(meal, userId));
        allRecords = [...allRecords, ...mealRecords];
      } catch (e) {
        console.error('Error migrating meals:', e);
      }
    }

    // Migrate sleep - handle multiple date-specific keys
    const sleepKeyPrefix = this.LEGACY_SLEEP_KEY_PREFIX(userId);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(sleepKeyPrefix)) {
        try {
          const sleepDataStr = localStorage.getItem(key);
          if (sleepDataStr) {
            const sleepData = JSON.parse(sleepDataStr);
            // Convert single sleep entry to array format if needed
            const sleepArray = Array.isArray(sleepData) ? sleepData : [sleepData];
            const sleepRecords = sleepArray.map(sleep => this.migrateSleepToRecord(sleep, userId));
            allRecords = [...allRecords, ...sleepRecords];
          }
        } catch (e) {
          console.error(`Error migrating sleep from key ${key}:`, e);
        }
      }
    }

    // Migrate XP (if needed)
    const legacyXP = localStorage.getItem(this.LEGACY_XP_KEY());
    if (legacyXP) {
      // XP is already handled by the new system, but we need to store it in the new location
      localStorage.setItem(this.XP_KEY(userId), legacyXP);
    }

    // Store unified records
    if (allRecords.length > 0) {
      localStorage.setItem(
        this.RECORDS_KEY(userId),
        JSON.stringify(allRecords)
      );

      console.log(`Migrated ${allRecords.length} records from legacy storage`);
    }

    return allRecords;
  }

  /**
   * Migrate an activity record to unified format
   */
  private static migrateActivityToRecord(legacyActivity: any, userId: string): WellnessRecord {
    return {
      id: this.generateId(),
      userId,
      timestamp: new Date(legacyActivity.timestamp || Date.now()),
      type: 'activity',
      category: legacyActivity.type || 'general',
      metrics: {
        duration: legacyActivity.duration || 0,
        calories: legacyActivity.calories || 0,
        xpEarned: legacyActivity.xpEarned || 0,
        intensity: legacyActivity.intensity || 5
      },
      metadata: {
        confidence: 1.0,
        aiInsights: [],
        tags: legacyActivity.tags || []
      }
    };
  }

  /**
   * Migrate a meal record to unified format
   */
  private static migrateMealToRecord(legacyMeal: any, userId: string): WellnessRecord {
    return {
      id: this.generateId(),
      userId,
      timestamp: new Date(legacyMeal.timestamp || Date.now()),
      type: 'meal',
      category: legacyMeal.mealType || 'general',
      metrics: {
        calories: legacyMeal.calories || 0,
        xpEarned: legacyMeal.xpEarned || 0,
        quantity: legacyMeal.quantity || 1,
        nutrition: legacyMeal.nutrition || undefined
      },
      metadata: {
        confidence: legacyMeal.confidence || 0.8,
        aiInsights: legacyMeal.insights || [],
        tags: legacyMeal.tags || []
      }
    };
  }

  /**
   * Migrate a sleep record to unified format
   */
  private static migrateSleepToRecord(legacySleep: any, userId: string): WellnessRecord {
    return {
      id: this.generateId(),
      userId,
      timestamp: new Date(legacySleep.timestamp || Date.now()),
      type: 'sleep',
      category: 'sleep',
      metrics: {
        duration: legacySleep.duration || 0,
        xpEarned: legacySleep.xpEarned || 0,
        quality: legacySleep.quality || 0.5
      },
      metadata: {
        confidence: 1.0,
        aiInsights: [],
        tags: legacySleep.tags || []
      }
    };
  }

  /**
   * Get session information for server sync
   */
  private static async getSession(): Promise<any> {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      // Try to get session from next-auth client-side
      try {
        const sessionResponse = await fetch('/api/auth/session');
        if (sessionResponse.ok) {
          return await sessionResponse.json();
        }
      } catch (e) {
        console.warn('Could not get session from /api/auth/session:', e);
      }
    }
    return null;
  }
}

export default ClientSafeUnifiedStore;