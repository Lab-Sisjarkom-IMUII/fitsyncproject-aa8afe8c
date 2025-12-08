export const dynamic = "force-dynamic";
export const revalidate = 0;

// Mock workout data store
let mockWorkouts = [
  {
    id: '1',
    name: 'Morning Cardio Blast',
    category: 'Cardio',
    duration: 30,
    intensity: 'Intermediate',
    calories: 250,
    thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    description: 'A high-intensity cardio workout to get your heart pumping and energy flowing.',
    exercises: [
      {
        id: 'e1',
        name: 'Jumping Jacks',
        duration: 60, // seconds
        sets: 3,
        rest: 30, // seconds
        demonstrationUrl: 'https://example.com/demo/jumping-jacks.gif',
        instructions: 'Stand with feet together, arms at sides. Jump while raising arms and spreading feet. Return to starting position.'
      },
      {
        id: 'e2',
        name: 'Mountain Climbers',
        duration: 45,
        sets: 3,
        rest: 30,
        demonstrationUrl: 'https://example.com/demo/mountain-climbers.gif',
        instructions: 'Start in plank position, alternate bringing knees to chest in quick succession.'
      },
      {
        id: 'e3',
        name: 'Burpees',
        duration: 60,
        sets: 3,
        rest: 45,
        demonstrationUrl: 'https://example.com/demo/burpees.gif',
        instructions: 'Start in standing position, drop to squat, jump back to plank, perform push-up, jump back to squat, and jump up.'
      }
    ]
  },
  {
    id: '2',
    name: 'Strength & Power',
    category: 'Strength',
    duration: 45,
    intensity: 'Advanced',
    calories: 300,
    thumbnail: 'https://images.unsplash.com/photo-1536922246289-88c42f957773?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    description: 'Build muscle and power with this strength-focused routine.',
    exercises: [
      {
        id: 'e4',
        name: 'Push-ups',
        duration: 45,
        sets: 4,
        rest: 60,
        demonstrationUrl: 'https://example.com/demo/push-ups.gif',
        instructions: 'Start in plank position, lower chest toward ground, push back up maintaining straight body alignment.'
      },
      {
        id: 'e5',
        name: 'Squats',
        duration: 60,
        sets: 4,
        rest: 60,
        demonstrationUrl: 'https://example.com/demo/squats.gif',
        instructions: 'Stand with feet shoulder-width apart, lower hips back and down as if sitting in a chair, return to standing.'
      },
      {
        id: 'e6',
        name: 'Lunges',
        duration: 60,
        sets: 3,
        rest: 45,
        demonstrationUrl: 'https://example.com/demo/lunges.gif',
        instructions: 'Step forward with one leg, lower hips until both knees are bent at 90 degrees, push back to starting position.'
      }
    ]
  },
  {
    id: '3',
    name: 'Yoga & Flexibility',
    category: 'Yoga',
    duration: 40,
    intensity: 'Beginner',
    calories: 150,
    thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    description: 'Improve flexibility and mindfulness with this yoga flow.',
    exercises: [
      {
        id: 'e7',
        name: 'Downward Dog',
        duration: 60,
        sets: 1,
        rest: 30,
        demonstrationUrl: 'https://example.com/demo/downward-dog.gif',
        instructions: 'Start on hands and knees, lift hips up and back, forming an inverted V-shape with your body.'
      },
      {
        id: 'e8',
        name: 'Warrior II',
        duration: 45,
        sets: 2,
        rest: 30,
        demonstrationUrl: 'https://example.com/demo/warrior-ii.gif',
        instructions: 'Step one foot back, bend front knee, extend arms parallel to the ground, gaze over front fingertips.'
      },
      {
        id: 'e9',
        name: 'Child\'s Pose',
        duration: 60,
        sets: 1,
        rest: 30,
        demonstrationUrl: 'https://example.com/demo/childs-pose.gif',
        instructions: 'Kneel on floor, sit back on heels, fold forward with arms extended or by your sides.'
      }
    ]
  },
  {
    id: '4',
    name: 'Quick HIIT',
    category: 'HIIT',
    duration: 20,
    intensity: 'Intermediate',
    calories: 200,
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    description: 'A quick high-intensity interval training session for maximum results in minimal time.',
    exercises: [
      {
        id: 'e10',
        name: 'High Knees',
        duration: 30,
        sets: 4,
        rest: 30,
        demonstrationUrl: 'https://example.com/demo/high-knees.gif',
        instructions: 'Run in place, bringing knees up to hip level as quickly as possible.'
      },
      {
        id: 'e11',
        name: 'Plank',
        duration: 45,
        sets: 3,
        rest: 30,
        demonstrationUrl: 'https://example.com/demo/plank.gif',
        instructions: 'Hold in push-up position with forearms on ground, maintaining straight line from head to heels.'
      },
      {
        id: 'e12',
        name: 'Sprint in Place',
        duration: 30,
        sets: 4,
        rest: 30,
        demonstrationUrl: 'https://example.com/demo/sprint-in-place.gif',
        instructions: 'Run in place at maximum effort, driving knees up and pumping arms.'
      }
    ]
  }
];

// XP calculation function
function calculateWorkoutXP(durationMinutes, intensityLevel) {
  const baseXP = 50;
  const durationXP = Math.floor(durationMinutes * 10);
  const intensityMultiplier = intensityLevel === 'Beginner' ? 1 : intensityLevel === 'Intermediate' ? 1.5 : 2;
  const intensityXP = Math.round(20 * intensityMultiplier);
  
  return baseXP + durationXP + intensityXP;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const intensity = searchParams.get('intensity');
    const duration = searchParams.get('duration');

    let filteredWorkouts = mockWorkouts;

    // Apply filters
    if (category) {
      filteredWorkouts = filteredWorkouts.filter(workout => 
        workout.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (intensity) {
      filteredWorkouts = filteredWorkouts.filter(workout => 
        workout.intensity.toLowerCase().includes(intensity.toLowerCase())
      );
    }

    if (duration) {
      const maxDuration = parseInt(duration);
      filteredWorkouts = filteredWorkouts.filter(workout => 
        workout.duration <= maxDuration
      );
    }

    return new Response(
      JSON.stringify(filteredWorkouts),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching workouts:', error);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST endpoint to track completed workout and update XP
export async function POST(request) {
  try {
    const { userId, workoutId, duration, calories, completed } = await request.json();
    
    if (!userId || !workoutId || !completed) {
      return new Response(
        JSON.stringify({ message: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find the completed workout to calculate XP
    const workout = mockWorkouts.find(w => w.id === workoutId);
    if (!workout) {
      return new Response(
        JSON.stringify({ message: 'Workout not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const xpEarned = calculateWorkoutXP(duration || workout.duration, workout.intensity);

    // In a real app, you'd update user data in a database
    // For now, we'll return the XP earned
    const workoutResult = {
      workoutId,
      duration: duration || workout.duration,
      calories: calories || workout.calories,
      xpEarned,
      completedAt: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(workoutResult),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error logging workout:', error);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}