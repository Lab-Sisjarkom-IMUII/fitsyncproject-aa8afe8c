export const dynamic = "force-dynamic";
export const revalidate = 0;

import { calculateLevelFromXP } from '@/lib/xpCalculator';
import { getSession } from '@/lib/session';
import { getUserProfile } from '@/lib/userProfile';

// Mock user data store - in a real app, this would be a database
let mockUsers = [];

export async function GET(request) {
  try {
    // In a real app, you'd get the user from the session/token
    // For this mock, we'll get the user from localStorage via session
    const session = getSession();
    if (!session) {
      return new Response(
        JSON.stringify({ message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Find user by username
    const user = mockUsers.find(u => u.username === session.username);
    if (!user) {
      // If user doesn't exist in mock store, create a new entry
      const newUser = {
        username: session.username,
        wellnessData: {
          steps: 0,
          goalSteps: 10000,
          calories: 0,
          sleep: '0h 0m',
          xp: 0,
          dailySteps: [],
          // Workout data
          completedWorkouts: [],
          workoutStreak: 0,
          lastWorkoutDate: null,
          // Meal data
          mealsLogged: 0,
          // Sleep data
          sleepData: [],
          lastSleepLogged: null
        }
      };
      mockUsers.push(newUser);
      return new Response(
        JSON.stringify({
          ...newUser.wellnessData,
          level: calculateLevelFromXP(newUser.wellnessData.xp)
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Add level information to the response
    const userDataWithLevel = {
      ...user.wellnessData,
      level: calculateLevelFromXP(user.wellnessData.xp)
    };

    return new Response(
      JSON.stringify(userDataWithLevel),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching user data:', error);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST endpoint to update user data
export async function POST(request) {
  try {
    const session = getSession();
    if (!session) {
      return new Response(
        JSON.stringify({ message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const { updates } = await request.json();
    
    // Find or create user
    let user = mockUsers.find(u => u.username === session.username);
    if (!user) {
      user = {
        username: session.username,
        wellnessData: {
          steps: 0,
          goalSteps: 10000,
          calories: 0,
          sleep: '0h 0m',
          xp: 0,
          dailySteps: [],
          completedWorkouts: [],
          workoutStreak: 0,
          lastWorkoutDate: null,
          mealsLogged: 0,
          sleepData: [],
          lastSleepLogged: null
        }
      };
      mockUsers.push(user);
    }
    
    // Update wellness data
    user.wellnessData = { ...user.wellnessData, ...updates };
    
    return new Response(
      JSON.stringify(user.wellnessData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating user data:', error);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// PUT endpoint to update XP and other data
export async function PUT(request) {
  try {
    const session = getSession();
    if (!session) {
      return new Response(
        JSON.stringify({ message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { xp, workoutData, mealData, sleepData, updates } = await request.json();
    
    // Find or create user
    let user = mockUsers.find(u => u.username === session.username);
    if (!user) {
      user = {
        username: session.username,
        wellnessData: {
          steps: 0,
          goalSteps: 10000,
          calories: 0,
          sleep: '0h 0m',
          xp: 0,
          dailySteps: [],
          completedWorkouts: [],
          workoutStreak: 0,
          lastWorkoutDate: null,
          mealsLogged: 0,
          sleepData: [],
          lastSleepLogged: null
        }
      };
      mockUsers.push(user);
    }
    
    // Handle XP updates
    if (xp !== undefined) {
      user.wellnessData.xp = (user.wellnessData.xp || 0) + xp;
    }
    
    // Handle workout data updates
    if (workoutData) {
      // Update workout-related data
      if (workoutData.completedWorkouts) {
        user.wellnessData.completedWorkouts = [
          ...(user.wellnessData.completedWorkouts || []),
          ...workoutData.completedWorkouts
        ];
      }
      
      if (workoutData.workoutStreak !== undefined) {
        user.wellnessData.workoutStreak = workoutData.workoutStreak;
      }
      
      if (workoutData.lastWorkoutDate) {
        user.wellnessData.lastWorkoutDate = workoutData.lastWorkoutDate;
      }
    }
    
    // Handle meal data updates
    if (mealData) {
      if (mealData.mealsLogged !== undefined) {
        user.wellnessData.mealsLogged = mealData.mealsLogged;
      }
    }
    
    // Handle sleep data updates
    if (sleepData) {
      if (sleepData.sleepData) {
        user.wellnessData.sleepData = [
          ...(user.wellnessData.sleepData || []),
          ...sleepData.sleepData
        ];
      }
      
      if (sleepData.lastSleepLogged) {
        user.wellnessData.lastSleepLogged = sleepData.lastSleepLogged;
      }
    }
    
    // Handle general updates
    if (updates) {
      user.wellnessData = { ...user.wellnessData, ...updates };
    }
    
    return new Response(
      JSON.stringify({
        ...user.wellnessData,
        level: calculateLevelFromXP(user.wellnessData.xp)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating user data:', error);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}