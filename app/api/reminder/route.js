export const dynamic = "force-dynamic";
export const revalidate = 0;

// Array of motivational messages
const motivationalMessages = [
  "🔥 You're 2000 steps away from your daily goal — keep going!",
  "💪 Great workout yesterday! Time to fuel up with extra protein today.",
  "😴 Your sleep was shorter than usual. Consider a lighter workout today.",
  "🌟 You're doing amazing! Remember to log your meals for better nutrition tracking.",
  "🏋️ Workout intensity seems low lately. Try increasing your weights gradually.",
  "🥗 Need more veggies? Try adding a salad to your next meal.",
  "🏆 3-day workout streak! Keep it up to reach your next achievement.",
  "💧 Don't forget to stay hydrated! Aim for 8 glasses of water today.",
  "😴 Consistent sleep schedule leads to better recovery. Aim for 7-9 hours tonight.",
  "🎉 You're 500 XP away from the next level! Great progress so far.",
  "🏃‍♂️ You've been walking more this week. Keep increasing your activity gradually.",
  "🍎 Consider a healthy snack between meals to maintain energy levels.",
  "📊 Your weekly trends look great! Keep maintaining this consistency.",
  "🎯 You're 10% closer to your monthly goal. Amazing progress!",
  "😴 Sleep quality affects performance. Focus on good sleep hygiene tonight."
];

// Array of workout recommendations based on context
const workoutRecommendations = [
  "Try a HIIT workout to boost your metabolism",
  "Focus on strength training to build muscle",
  "Do some yoga for flexibility and recovery",
  "Go for a run to improve your cardiovascular health",
  "Try a full-body circuit for maximum efficiency",
  "Do some core exercises to improve stability"
];

// Array of nutrition recommendations
const nutritionRecommendations = [
  "Increase your protein intake for muscle recovery",
  "Add more fiber-rich foods to your diet",
  "Stay hydrated with water instead of sugary drinks",
  "Include more colorful vegetables in your meals",
  "Choose whole grains over refined options",
  "Plan your meals ahead for better nutrition"
];

// Array of sleep recommendations
const sleepRecommendations = [
  "Maintain a consistent sleep schedule",
  "Create a relaxing bedtime routine",
  "Avoid screens 1 hour before bedtime",
  "Keep your bedroom cool and dark",
  "Try meditation or deep breathing for better sleep",
  "Avoid caffeine late in the day"
];

export async function GET(request) {
  try {
    // Get context from query parameters (simulating AI analysis)
    const { searchParams } = new URL(request.url);
    const context = searchParams.get('context') || 'general';
    const userId = searchParams.get('userId');
    
    let message = '';
    let type = 'motivation';
    
    // Generate context-aware message
    switch(context) {
      case 'steps':
        const steps = parseInt(searchParams.get('steps') || '0');
        const goal = parseInt(searchParams.get('goal') || '10000');
        if (steps < goal * 0.5) {
          message = `🚶‍♂️ You've taken ${steps} steps today. You're halfway to your goal of ${goal}!`;
        } else if (steps < goal) {
          message = `🔥 You're at ${steps}/${goal} steps! Only ${goal - steps} steps away from your goal.`;
        } else {
          message = `🎉 Great job! You've reached your step goal of ${goal} steps today.`;
        }
        type = 'steps';
        break;
        
      case 'workout':
        const workoutStatus = searchParams.get('status') || 'not_completed';
        if (workoutStatus === 'not_completed') {
          message = `💪 It's time for your workout! Don't skip leg day!`;
        } else {
          message = `🏆 Awesome workout! Your consistency will pay off soon.`;
        }
        type = 'workout';
        break;
        
      case 'sleep':
        const sleepHours = parseFloat(searchParams.get('hours') || '0');
        if (sleepHours < 6) {
          message = `😴 You only got ${sleepHours} hours of sleep. Aim for 7-9 hours for better recovery.`;
        } else if (sleepHours > 9) {
          message = `😴 You slept ${sleepHours} hours. While rest is important, try not to exceed 9 hours regularly.`;
        } else {
          message = `😴 Good sleep of ${sleepHours} hours! Your body will thank you tomorrow.`;
        }
        type = 'sleep';
        break;
        
      case 'nutrition':
        const mealsLogged = parseInt(searchParams.get('mealsLogged') || '0');
        if (mealsLogged < 2) {
          message = `🥗 Remember to log your meals! You've only logged ${mealsLogged} today.`;
        } else {
          message = `✅ Great job on logging ${mealsLogged} meals. Keep up the good nutrition tracking!`;
        }
        type = 'nutrition';
        break;
        
      default:
        // Return a random motivational message
        message = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
        break;
    }
    
    // Prepare additional context-based recommendations
    const recommendations = [];
    
    if (context !== 'workout' && Math.random() > 0.7) {
      recommendations.push({
        type: 'workout',
        message: workoutRecommendations[Math.floor(Math.random() * workoutRecommendations.length)]
      });
    }
    
    if (context !== 'nutrition' && Math.random() > 0.7) {
      recommendations.push({
        type: 'nutrition',
        message: nutritionRecommendations[Math.floor(Math.random() * nutritionRecommendations.length)]
      });
    }
    
    if (context !== 'sleep' && Math.random() > 0.7) {
      recommendations.push({
        type: 'sleep',
        message: sleepRecommendations[Math.floor(Math.random() * sleepRecommendations.length)]
      });
    }
    
    const response = {
      message,
      type,
      timestamp: new Date().toISOString(),
      recommendations,
      mood: Math.floor(Math.random() * 5) + 1 // 1-5 mood scale
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating reminder:', error);
    // Return a random fallback message
    const fallbackMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    return new Response(
      JSON.stringify({ 
        message: fallbackMessage,
        type: 'fallback',
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}