export const dynamic = "force-dynamic";
export const revalidate = 0;

// Simulate wearable steps data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '1';
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly
    
    let stepsData = {};
    
    if (period === 'daily') {
      // Generate random steps between 3000-15000 for today
      const todaySteps = Math.floor(Math.random() * 12000) + 3000;
      const dailyGoal = 10000;
      
      stepsData = {
        userId,
        date: new Date().toISOString().split('T')[0],
        steps: todaySteps,
        goal: dailyGoal,
        progress: Math.min(100, Math.round((todaySteps / dailyGoal) * 100)),
        source: 'FitSync Simulator'
      };
    } else if (period === 'weekly') {
      // Generate weekly steps data
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weeklyData = days.map(day => {
        return {
          day,
          date: new Date().toISOString().split('T')[0], // In a real implementation, this would be actual dates
          steps: Math.floor(Math.random() * 12000) + 3000
        };
      });
      
      stepsData = {
        userId,
        period: 'weekly',
        data: weeklyData,
        source: 'FitSync Simulator'
      };
    } else if (period === 'monthly') {
      // Generate monthly steps data (simplified)
      const monthlySteps = Math.floor(Math.random() * 300000) + 100000; // Average ~10000 steps/day * 30 days
      const monthlyGoal = 300000;
      
      stepsData = {
        userId,
        period: 'monthly',
        totalSteps: monthlySteps,
        goal: monthlyGoal,
        progress: Math.min(100, Math.round((monthlySteps / monthlyGoal) * 100)),
        source: 'FitSync Simulator'
      };
    }
    
    return new Response(
      JSON.stringify(stepsData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching steps data:', error);
    return new Response(
      JSON.stringify({ 
        message: 'Internal server error', 
        error: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST endpoint to simulate data sync from wearable
export async function POST(request) {
  try {
    const { userId, steps, timestamp } = await request.json();
    
    if (!userId || steps === undefined) {
      return new Response(
        JSON.stringify({ message: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // In a real app, this would update the user's step count in the database
    // For now, we'll just return the data that was sent
    const response = {
      userId,
      steps,
      timestamp: timestamp || new Date().toISOString(),
      status: 'synced',
      message: 'Steps data received from wearable'
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing steps data:', error);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}