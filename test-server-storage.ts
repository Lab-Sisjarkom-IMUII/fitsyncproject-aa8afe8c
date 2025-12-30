// Test script for server unified store
import ServerUnifiedStore from './lib/storage/server-unified-store';

async function runTests() {
  console.log('Starting ServerUnifiedStore tests...');
  
  const userId = 'test-user-123';
  
  try {
    // Test 1: Add a record
    console.log('\n1. Testing addRecord...');
    const testRecord = {
      userId,
      timestamp: new Date(),
      type: 'meal',
      category: 'breakfast',
      metrics: {
        calories: 350,
        xpEarned: 10
      },
      metadata: {
        confidence: 0.9,
        aiInsights: ['Good nutritional balance'],
        tags: ['healthy']
      }
    };
    
    const addedRecord = await ServerUnifiedStore.addRecord(userId, testRecord);
    console.log('✓ Record added:', addedRecord.id);
    
    // Test 2: Get records
    console.log('\n2. Testing getRecords...');
    const records = await ServerUnifiedStore.getRecords(userId, { limit: 10 });
    console.log(`✓ Retrieved ${records.length} records`);
    
    // Test 3: Get daily summary
    console.log('\n3. Testing getDailySummary...');
    const today = new Date();
    const dailySummary = await ServerUnifiedStore.getDailySummary(userId, today);
    console.log('✓ Daily summary:', dailySummary);
    
    // Test 4: Test migration
    console.log('\n4. Testing migrateFromClient...');
    const migrationResult = await ServerUnifiedStore.migrateFromClient(userId, [
      {
        id: 'test-migration-1',
        userId,
        timestamp: new Date(),
        type: 'activity',
        category: 'running',
        metrics: { calories: 400, xpEarned: 25, duration: 3600 },
        metadata: { confidence: 0.95 }
      }
    ]);
    console.log('✓ Migration result:', migrationResult);
    
    console.log('\n✓ All tests passed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up: delete the test records (optional)
    console.log('\n5. Cleanup - deleting test records...');
    console.log('Note: Direct deletion of test records skipped for safety');
  }
}

if (require.main === module) {
  runTests();
}

export default runTests;