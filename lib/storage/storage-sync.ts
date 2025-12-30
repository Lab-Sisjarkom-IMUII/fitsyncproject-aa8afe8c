/**
 * Storage sync utilities for FitSync
 * Handles migration of local data to server and synchronization
 */

/**
 * Migrate all local unified store data to server
 */
export async function migrateLocalToServer(userId: string) {
  if (typeof window === 'undefined') {
    console.warn('Server-side migration not supported');
    return { success: false, error: 'Client-side only operation' };
  }

  try {
    // Get all local unified data
    const unifiedKey = `fitsync_unified_records_${userId}`;
    const localData = localStorage.getItem(unifiedKey);
    
    // Also check for alternative userId formats
    let records = [];
    if (localData) {
      records = JSON.parse(localData);
    } else {
      // Try other formats
      const userIdParts = userId.includes('@') ? [userId, userId.split('@')[0]] : [userId, `${userId}@example.com`];
      
      for (const tryUserId of userIdParts) {
        const tryKey = `fitsync_unified_records_${tryUserId}`;
        const tryData = localStorage.getItem(tryKey);
        if (tryData) {
          records = JSON.parse(tryData);
          break;
        }
      }
    }

    if (!records || records.length === 0) {
      console.log('No local records to migrate');
      return { success: true, migratedCount: 0 };
    }

    // Get legacy data as well
    const legacyRecords = await getLegacyRecords(userId);
    const allRecords = [...records, ...legacyRecords];

    // Send to server for migration
    const response = await fetch(`/api/storage/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, records: allRecords }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Migration failed');
    }

    // Clear local legacy keys after successful migration
    clearLocalLegacyData(userId);

    console.log('Migration completed:', result);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error migrating local data to server:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get legacy records for migration
 */
async function getLegacyRecords(userId: string) {
  const records = [];

  // Get legacy activities
  const legacyActivityKey = `activities_${userId}`;
  const legacyActivities = localStorage.getItem(legacyActivityKey);
  if (legacyActivities) {
    const activities = JSON.parse(legacyActivities);
    for (const activity of activities) {
      records.push({
        id: `migrated-act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        timestamp: activity.timestamp || new Date().toISOString(),
        type: 'activity',
        category: activity.type || 'general',
        metrics: {
          duration: activity.duration || 0,
          calories: activity.calories || 0,
          xpEarned: activity.xpEarned || 0,
          intensity: activity.intensity || 5
        },
        metadata: {
          confidence: 1.0,
          aiInsights: [],
          tags: activity.tags || []
        }
      });
    }
  }

  // Get legacy meals
  const legacyMealKey = `meals_${userId}`;
  const legacyMeals = localStorage.getItem(legacyMealKey);
  if (legacyMeals) {
    const meals = JSON.parse(legacyMeals);
    for (const meal of meals) {
      records.push({
        id: `migrated-meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        timestamp: meal.timestamp || new Date().toISOString(),
        type: 'meal',
        category: meal.mealType || 'general',
        metrics: {
          calories: meal.calories || 0,
          xpEarned: meal.xpEarned || 0,
          quantity: meal.quantity || 1,
          nutrition: meal.nutrition || undefined
        },
        metadata: {
          confidence: meal.confidence || 0.8,
          aiInsights: meal.insights || [],
          tags: meal.tags || []
        }
      });
    }
  }

  // Get legacy sleep records
  const sleepKeyPattern = new RegExp(`^sleep_${userId}_`);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (sleepKeyPattern.test(key)) {
      const sleepDataStr = localStorage.getItem(key);
      if (sleepDataStr) {
        const sleepData = Array.isArray(JSON.parse(sleepDataStr)) ? JSON.parse(sleepDataStr) : [JSON.parse(sleepDataStr)];
        for (const sleep of sleepData) {
          records.push({
            id: `migrated-sleep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId,
            timestamp: sleep.timestamp || new Date().toISOString(),
            type: 'sleep',
            category: 'sleep',
            metrics: {
              duration: sleep.duration || 0,
              xpEarned: sleep.xpEarned || 0,
              quality: sleep.quality || 0.5
            },
            metadata: {
              confidence: 1.0,
              aiInsights: [],
              tags: sleep.tags || []
            }
          });
        }
      }
    }
  }

  return records;
}

/**
 * Clear local legacy data after successful migration
 */
function clearLocalLegacyData(userId: string) {
  // Clear unified store data
  const unifiedKey = `fitsync_unified_records_${userId}`;
  localStorage.removeItem(unifiedKey);
  
  // Clear legacy data keys
  const legacyKeys = [
    `activities_${userId}`,
    `meals_${userId}`,
    `fitsync-xp`
  ];
  
  for (const key of legacyKeys) {
    localStorage.removeItem(key);
  }
  
  // Clear sleep data
  const sleepKeyPattern = new RegExp(`^sleep_${userId}_`);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && sleepKeyPattern.test(key)) {
      localStorage.removeItem(key);
    }
  }
  
  // Clear date-specific sleep keys
  const dateSleepKeyPattern = new RegExp(`^sleep-${userId}-\\d{4}-\\d{2}-\\d{2}$`);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && dateSleepKeyPattern.test(key)) {
      localStorage.removeItem(key);
    }
  }
  
  console.log('Cleared local legacy data for user:', userId);
}

export default migrateLocalToServer;