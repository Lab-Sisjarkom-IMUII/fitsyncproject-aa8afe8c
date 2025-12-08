export const dynamic = "force-dynamic";
export const revalidate = 0;

// Simulate wearable sleep data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '1';
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly
    
    let sleepData = {};
    
    if (period === 'daily') {
      // Generate random sleep data for today (between 4-10 hours)
      const sleepHours = parseFloat((Math.random() * 6 + 4).toFixed(1));
      const sleepGoal = 8; // 8 hours goal
      
      // Determine sleep quality based on duration
      let quality = 'Good';
      if (sleepHours < 6) quality = 'Poor';
      else if (sleepHours > 9) quality = 'Excellent';
      else quality = 'Good';
      
      const efficiency = Math.floor(Math.random() * 20) + 80; // 80-100% efficiency
      
      sleepData = {
        userId,
        date: new Date().toISOString().split('T')[0],
        hours: sleepHours,
        goal: sleepGoal,
        progress: Math.min(100, Math.round((sleepHours / sleepGoal) * 100)),
        quality,
        efficiency,
        source: 'FitSync Simulator'
      };
    } else if (period === 'weekly') {
      // Generate weekly sleep data
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weeklyData = days.map(day => {
        const hours = parseFloat((Math.random() * 6 + 4).toFixed(1));
        let quality = 'Good';
        if (hours < 6) quality = 'Poor';
        else if (hours > 9) quality = 'Excellent';
        
        return {
          day,
          date: new Date().toISOString().split('T')[0], // In a real implementation, this would be actual dates
          hours,
          quality,
          efficiency: Math.floor(Math.random() * 20) + 80
        };
      });
      
      sleepData = {
        userId,
        period: 'weekly',
        data: weeklyData,
        source: 'FitSync Simulator'
      };
    } else if (period === 'monthly') {
      // Generate monthly sleep data (simplified)
      const monthlyAvg = parseFloat((Math.random() * 2 + 6).toFixed(1)); // Average 6-8 hours
      const monthlyGoal = 8;
      
      sleepData = {
        userId,
        period: 'monthly',
        avgHours: monthlyAvg,
        goal: monthlyGoal,
        progress: Math.min(100, Math.round((monthlyAvg / monthlyGoal) * 100)),
        source: 'FitSync Simulator'
      };
    }
    
    return new Response(
      JSON.stringify(sleepData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching sleep data:', error);
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
    const { userId, hours, quality, timestamp } = await request.json();
    
    if (!userId || hours === undefined) {
      return new Response(
        JSON.stringify({ message: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // In a real app, this would update the user's sleep data in the database
    // For now, we'll just return the data that was sent
    const response = {
      userId,
      hours,
      quality: quality || 'Good',
      timestamp: timestamp || new Date().toISOString(),
      status: 'synced',
      message: 'Sleep data received from wearable'
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing sleep data:', error);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}