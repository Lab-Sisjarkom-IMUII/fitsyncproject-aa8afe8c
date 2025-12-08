export const dynamic = "force-dynamic";
export const revalidate = 0;

// Simulate wearable calories data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '1';
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly
    
    let caloriesData = {};
    
    if (period === 'daily') {
      // Generate random calories between 1800-3000 for today
      const todayCalories = Math.floor(Math.random() * 1200) + 1800;
      const dailyGoal = 2200;
      
      caloriesData = {
        userId,
        date: new Date().toISOString().split('T')[0],
        calories: todayCalories,
        goal: dailyGoal,
        progress: Math.min(100, Math.round((todayCalories / dailyGoal) * 100)),
        source: 'FitSync Simulator'
      };
    } else if (period === 'weekly') {
      // Generate weekly calories data
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weeklyData = days.map(day => {
        return {
          day,
          date: new Date().toISOString().split('T')[0], // In a real implementation, this would be actual dates
          calories: Math.floor(Math.random() * 1200) + 1800
        };
      });
      
      caloriesData = {
        userId,
        period: 'weekly',
        data: weeklyData,
        source: 'FitSync Simulator'
      };
    } else if (period === 'monthly') {
      // Generate monthly calories data (simplified)
      const monthlyCalories = Math.floor(Math.random() * 66000) + 54000; // Average ~2200 calories/day * 30 days
      const monthlyGoal = 66000;
      
      caloriesData = {
        userId,
        period: 'monthly',
        totalCalories: monthlyCalories,
        goal: monthlyGoal,
        progress: Math.min(100, Math.round((monthlyCalories / monthlyGoal) * 100)),
        source: 'FitSync Simulator'
      };
    }
    
    return new Response(
      JSON.stringify(caloriesData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching calories data:', error);
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
    const { userId, calories, timestamp } = await request.json();
    
    if (!userId || calories === undefined) {
      return new Response(
        JSON.stringify({ message: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // In a real app, this would update the user's calorie count in the database
    // For now, we'll just return the data that was sent
    const response = {
      userId,
      calories,
      timestamp: timestamp || new Date().toISOString(),
      status: 'synced',
      message: 'Calories data received from wearable'
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing calories data:', error);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}