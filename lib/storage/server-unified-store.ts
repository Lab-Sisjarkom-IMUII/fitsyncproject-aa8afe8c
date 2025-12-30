import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the project root directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..'); // Go up two levels to project root
const dbPath = join(projectRoot, '.data', 'fitsync.sqlite');

// Ensure the .data directory exists
import fs from 'fs';
const dataDir = join(projectRoot, '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize database schema
function initDb() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create records table
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      payload TEXT, -- JSON string
      timestamp DATETIME NOT NULL,
      calories REAL DEFAULT 0,
      xp INTEGER DEFAULT 0,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Create daily nutrition summary table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_nutrition (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      userId TEXT NOT NULL,
      totals TEXT, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(date, userId)
    )
  `);

  // Create indexes for performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_records_userId_timestamp ON records(userId, timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_records_type ON records(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_nutrition_userId_date ON daily_nutrition(userId, date)`);
}

// Initialize database on module load
initDb();

interface WellnessRecord {
  id: string;
  userId: string;
  timestamp: Date;
  type: string;
  category: string;
  metrics: {
    calories?: number;
    xpEarned?: number;
    duration?: number;
    quantity?: number;
    quality?: number;
    [key: string]: any;
  };
  metadata: {
    confidence?: number;
    aiInsights?: string[];
    tags?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

interface DailySummary {
  date: string;
  steps: number;
  caloriesIn: number;
  caloriesOut: number;
  netCalories: number;
  sleepHours: number;
  xp: number;
  records: any[];
}

class ServerUnifiedStore {
  /**
   * Add a new wellness record to the database
   */
  static async addRecord(userId: string, record: Omit<WellnessRecord, 'id'>): Promise<WellnessRecord> {
    const recordId = record.id || this.generateId();
    
    // Prepare the record for storage
    const preparedRecord: WellnessRecord = {
      ...record,
      id: recordId,
      userId,
      timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp
    };

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO records (id, userId, type, category, payload, timestamp, calories, xp)
      VALUES (@id, @userId, @type, @category, @payload, @timestamp, @calories, @xp)
    `);

    const result = stmt.run({
      id: preparedRecord.id,
      userId: preparedRecord.userId,
      type: preparedRecord.type,
      category: preparedRecord.category,
      payload: JSON.stringify(preparedRecord),
      timestamp: preparedRecord.timestamp,
      calories: preparedRecord.metrics?.calories || 0,
      xp: preparedRecord.metrics?.xpEarned || 0
    });

    if (result.changes === 0) {
      throw new Error('Failed to insert record into database');
    }

    // Return the record as it was stored
    return preparedRecord as any;
  }

  /**
   * Get wellness records for a user with optional filters
   */
  static async getRecords(userId: string, options: { 
    limit?: number, 
    fromDate?: Date, 
    toDate?: Date 
  } = {}): Promise<WellnessRecord[]> {
    let query = 'SELECT * FROM records WHERE userId = ?';
    const params: any[] = [userId];

    if (options.fromDate) {
      query += ' AND timestamp >= ?';
      params.push(options.fromDate.toISOString());
    }

    if (options.toDate) {
      query += ' AND timestamp <= ?';
      params.push(options.toDate.toISOString());
    }

    query += ' ORDER BY timestamp DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      ...JSON.parse(row.payload),
      timestamp: new Date(row.timestamp) // Convert back to Date object
    }));
  }

  /**
   * Delete a specific record by ID
   */
  static async deleteRecord(userId: string, id: string): Promise<boolean> {
    const stmt = db.prepare(`
      DELETE FROM records 
      WHERE userId = ? AND id = ?
    `);

    const result = stmt.run(userId, id);

    return result.changes > 0;
  }

  /**
   * Get daily summary for a specific date
   */
  static async getDailySummary(userId: string, date: Date): Promise<DailySummary> {
    const dateStr = date.toISOString().split('T')[0];
    const startOfDay = new Date(dateStr);
    const endOfDay = new Date(dateStr);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Get records for the day
    const records = await this.getRecords(userId, {
      fromDate: startOfDay,
      toDate: endOfDay
    });

    // Calculate totals
    let steps = 0;
    let caloriesIn = 0;
    let caloriesOut = 0;
    let sleepHours = 0;
    let xp = 0;

    records.forEach(record => {
      if (record.type === 'meal') {
        caloriesIn += record.metrics?.calories || 0;
      } else if (record.type === 'activity') {
        caloriesOut += record.metrics?.calories || 0;
        steps += record.metrics?.quantity || 0; // Assuming steps are stored as quantity
        xp += record.metrics?.xpEarned || 0;
      } else if (record.type === 'sleep') {
        sleepHours += (record.metrics?.duration || 0) / 60; // Convert minutes to hours
        xp += record.metrics?.xpEarned || 0;
      }
    });

    const netCalories = caloriesIn - caloriesOut;

    return {
      date: dateStr,
      steps,
      caloriesIn,
      caloriesOut,
      netCalories,
      sleepHours,
      xp,
      records
    };
  }

  /**
   * Migrate data from client-side records, deduplicating where necessary
   */
  static async migrateFromClient(userId: string, records: WellnessRecord[]): Promise<{
    totalProcessed: number;
    totalInserted: number;
    duplicatesSkipped: number;
    errors: string[];
  }> {
    let totalProcessed = 0;
    let totalInserted = 0;
    let duplicatesSkipped = 0;
    const errors: string[] = [];

    // Prepare a statement to check for duplicates
    const checkDuplicateStmt = db.prepare(`
      SELECT id FROM records 
      WHERE userId = ? 
      AND type = ?
      AND date(timestamp) = date(?)
      AND (calories = ? OR ? IS NULL)
    `);

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO records (id, userId, type, category, payload, timestamp, calories, xp)
      VALUES (@id, @userId, @type, @category, @payload, @timestamp, @calories, @xp)
    `);

    for (const record of records) {
      totalProcessed++;
      
      try {
        // Create a unique key for deduplication
        // We'll check by type + date + calories (when available)
        const timestamp = record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp;
        const calories = record.metrics?.calories || 0;
        
        // Check for duplicate
        const duplicate = checkDuplicateStmt.get(userId, record.type, timestamp, calories, calories);
        
        if (duplicate) {
          // Skip duplicate
          duplicatesSkipped++;
          continue;
        }
        
        // Prepare the record for storage
        const preparedRecord: WellnessRecord = {
          ...record,
          userId,
          timestamp: timestamp
        };

        // Insert the record
        const result = insertStmt.run({
          id: record.id,
          userId,
          type: record.type,
          category: record.category,
          payload: JSON.stringify(preparedRecord),
          timestamp,
          calories: record.metrics?.calories || 0,
          xp: record.metrics?.xpEarned || 0
        });

        if (result.changes > 0) {
          totalInserted++;
        }
      } catch (error) {
        errors.push(`Error processing record ${record.id}: ${error.message}`);
      }
    }

    return {
      totalProcessed,
      totalInserted,
      duplicatesSkipped,
      errors
    };
  }

  /**
   * Generate a unique ID for records
   */
  private static generateId(): string {
    return `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get database instance for direct queries (for advanced use cases)
   */
  static getDatabase() {
    return db;
  }
}

export default ServerUnifiedStore;