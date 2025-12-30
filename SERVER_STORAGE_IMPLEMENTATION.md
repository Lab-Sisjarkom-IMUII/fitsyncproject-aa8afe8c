# FitSync Server-Side Storage Implementation

This document describes the server-side persistent storage system implemented for FitSync.

## Overview

The new server-side storage system provides reliable, persistent storage for all wellness records (meals, activities, sleep, XP, goals) while maintaining backward compatibility with client-side storage.

## Architecture

### Database Schema

The system uses SQLite with the following tables:

1. **users** - Stores user information
   - id (TEXT PRIMARY KEY)
   - email (TEXT UNIQUE)
   - created_at, updated_at (DATETIME)

2. **records** - Stores all wellness records
   - id (TEXT PRIMARY KEY)
   - userId (TEXT NOT NULL, FOREIGN KEY)
   - type (TEXT NOT NULL) - 'meal', 'activity', 'sleep', etc.
   - category (TEXT)
   - payload (TEXT) - JSON string with full record data
   - timestamp (DATETIME NOT NULL)
   - calories (REAL)
   - xp (INTEGER)

3. **daily_nutrition** - Stores daily nutritional summaries
   - id (INTEGER PRIMARY KEY AUTOINCREMENT)
   - date (TEXT NOT NULL)
   - userId (TEXT NOT NULL, FOREIGN KEY)
   - totals (TEXT) - JSON string with daily totals

### File Structure

- `lib/storage/server-unified-store.ts` - Main server storage implementation
- `lib/storage/storage-sync.ts` - Client-to-server sync utilities
- API routes in `app/api/storage/...` - REST API endpoints

## API Endpoints

### Authentication

All endpoints require NextAuth session validation. The requesting userId must match the authenticated user's ID.

### Endpoints

1. **POST** `/api/storage/migrate`
   - Migrate client-side records to server
   - Body: `{ userId, records: [...] }`
   - Returns migration summary

2. **GET** `/api/storage/[userId]/records?limit=50&from=YYYY-MM-DD&to=YYYY-MM-DD`
   - Get records for user with optional filters
   - Returns paginated records

3. **POST** `/api/storage/[userId]/record`
   - Add a single record
   - Body: Wellness record object
   - Returns the created record

4. **DELETE** `/api/storage/[userId]/record/[id]`
   - Delete a specific record
   - Returns success status

5. **GET** `/api/storage/[userId]/daily-summary?date=YYYY-MM-DD`
   - Get daily aggregated summary
   - Date is optional (defaults to today)
   - Returns summary with steps, calories, sleep, etc.

### Rate Limiting

All endpoints implement rate limiting (100 requests per 15-minute window per IP).

## Migration Process

When a user logs in, the system:

1. Checks for local storage data
2. Collects unified and legacy records
3. Sends to the `/api/storage/migrate` endpoint
4. Server deduplicates and inserts records
5. Client clears local legacy data after successful migration

## Client-Side Integration

The `ClientSafeUnifiedStore` now:

1. Continues to work with localStorage for offline support
2. Attempts to sync with server when authenticated
3. Falls back to localStorage if server is unavailable
4. Maintains backward compatibility

## Security

- All endpoints validate user session
- Users can only access their own data
- Rate limiting prevents abuse
- Input validation on all endpoints

## Setup

1. Install dependencies:
   ```bash
   npm install better-sqlite3
   ```

2. Database file will be created automatically at `.data/fitsync.sqlite`

## Testing

Run the test script to verify functionality:
```bash
npx tsx test-server-storage.ts
```

## Environment

The system will create a `.data/fitsync.sqlite` file in the project root directory for persistent storage.

## Example Requests

### Migrate data from client:
```bash
curl -X POST http://localhost:3000/api/storage/migrate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user@example.com",
    "records": [
      {
        "id": "record_123",
        "timestamp": "2023-01-01T10:00:00Z",
        "type": "meal",
        "category": "breakfast",
        "metrics": {
          "calories": 350,
          "xpEarned": 10
        }
      }
    ]
  }'
```

### Get user records:
```bash
curl "http://localhost:3000/api/storage/user@example.com/records?limit=10"
```

### Add single record:
```bash
curl -X POST http://localhost:3000/api/storage/user@example.com/record \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2023-01-01T10:00:00Z",
    "type": "activity",
    "category": "running",
    "metrics": {
      "calories": 400,
      "xpEarned": 25,
      "duration": 3600
    }
  }'
```

### Get daily summary:
```bash
curl "http://localhost:3000/api/storage/user@example.com/daily-summary?date=2023-01-01"
```

## Deduplication Strategy

The migration system prevents duplicate records by checking for:

- Same type + date + approximate calories (within 10% tolerance)
- Or same ID if provided in the original record

## Error Handling

- Server gracefully handles malformed data
- Migration continues for valid records even if some fail
- Rate limiting prevents API abuse
- All operations are logged for debugging