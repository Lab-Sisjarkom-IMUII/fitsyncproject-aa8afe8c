// app/api/ai/reminder/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { askAI } from "@/lib/aiService";
import { prompts } from "@/lib/aiPrompts";

interface UserData {
  name?: string;
  level?: number;
  xp?: number;
  streak?: number;
  steps?: number;
  calories?: number;
  goalSteps?: number;
  recentActivity?: string;
  fitnessGoal?: 'weight_loss' | 'muscle_gain' | 'endurance' | 'maintain_weight';
  duration?: number;
  equipment?: string[];
  dietaryRestrictions?: string[];
  foodPreferences?: string[];
  activityLevel?: number;
  sleep?: number;
  weight?: number;
  height?: number;
  gender?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const context = searchParams.get('context') || 'general';
    const userId = searchParams.get('userId');
    
    // Get user data from query parameters
    const userData: UserData = {
      name: searchParams.get('name') || 'User',
      level: parseInt(searchParams.get('level') || '1'),
      xp: parseInt(searchParams.get('xp') || '0'),
      streak: parseInt(searchParams.get('streak') || '0'),
      steps: parseInt(searchParams.get('steps') || '0'),
      calories: parseInt(searchParams.get('calories') || '0'),
      goalSteps: parseInt(searchParams.get('goal') || '10000'),
      recentActivity: searchParams.get('recentActivity') || 'regular activity',
      fitnessGoal: (searchParams.get('fitnessGoal') as any) || 'maintain_weight',
      activityLevel: parseInt(searchParams.get('activityLevel') || '3'),
      sleep: parseFloat(searchParams.get('sleep') || '0'),
    };

    let aiResponse: { reply: string };
    let message = '';

    switch(context) {
      case 'motivation':
        try {
          const prompt = prompts.motivationalShort(userData);
          aiResponse = await askAI(prompt);
          message = aiResponse.reply;
        } catch (error) {
          console.error('Error generating AI motivation:', error);
          // Fallback to a default message
          message = "Keep up the great work! Every step counts towards your goals.";
        }
        break;
        
      case 'steps':
        try {
          const steps = userData.steps || 0;
          const goal = userData.goalSteps || 10000;
          const prompt = `Based on user's step count of ${steps} with a goal of ${goal}, provide a short motivational message. If they're close to the goal, encourage them. If they've reached it, congratulate them.`;
          aiResponse = await askAI(prompt);
          message = aiResponse.reply;
        } catch (error) {
          console.error('Error generating AI steps message:', error);
          message = `You've taken ${userData.steps || 0} steps today. Keep moving towards your goal of ${userData.goalSteps || 10000}!`;
        }
        break;
        
      case 'workout':
        try {
          const workoutStatus = searchParams.get('status') || 'not_completed';
          const prompt = `Provide a motivational message for a user based on their workout status: ${workoutStatus}. Be encouraging and fitness-focused.`;
          aiResponse = await askAI(prompt);
          message = aiResponse.reply;
        } catch (error) {
          console.error('Error generating AI workout message:', error);
          const workoutStatus = searchParams.get('status') || 'not_completed'; // Define again in catch block
          message = workoutStatus === 'not_completed' 
            ? "It's time for your workout! Don't skip leg day!" 
            : "Awesome workout! Your consistency will pay off soon.";
        }
        break;
        
      case 'sleep':
        try {
          const sleepHours = userData.sleep || 0;
          const prompt = `Based on user's sleep of ${sleepHours} hours, provide a short message about recovery and sleep quality. Include tips if sleep was insufficient.`;
          aiResponse = await askAI(prompt);
          message = aiResponse.reply;
        } catch (error) {
          console.error('Error generating AI sleep message:', error);
          const sleepHours = userData.sleep || 0; // Define again in catch block
          message = `You slept ${sleepHours} hours. Good sleep is crucial for recovery and performance.`;
        }
        break;
        
      case 'nutrition':
        try {
          const mealsLogged = parseInt(searchParams.get('mealsLogged') || '0');
          const prompt = `Provide a nutrition-related motivational message based on the user's meals logged: ${mealsLogged}. Encourage good nutrition habits.`;
          aiResponse = await askAI(prompt);
          message = aiResponse.reply;
        } catch (error) {
          console.error('Error generating AI nutrition message:', error);
          const mealsLogged = parseInt(searchParams.get('mealsLogged') || '0'); // Define again in catch block
          message = `You've logged ${mealsLogged} meals today. Keep up the good nutrition tracking!`;
        }
        break;
        
      default:
        try {
          const prompt = prompts.motivationalShort(userData);
          aiResponse = await askAI(prompt);
          message = aiResponse.reply;
        } catch (error) {
          console.error('Error generating default AI message:', error);
          message = "You're doing amazing! Keep up the good work on your fitness journey.";
        }
        break;
    }

    // Prepare additional context-based recommendations
    const recommendations = [];

    if (context !== 'workout') {
      try {
        const workoutPrompt = `Based on the user profile, suggest a brief workout type or activity that would benefit them. User data: level ${userData.level}, goal ${userData.fitnessGoal}, activity level ${userData.activityLevel}`;
        const workoutResponse = await askAI(workoutPrompt);
        recommendations.push({
          type: 'workout',
          message: workoutResponse.reply
        });
      } catch (error) {
        // If AI fails, add a default recommendation
        recommendations.push({
          type: 'workout',
          message: 'Try incorporating strength training 2-3 times per week for better results'
        });
      }
    }

    if (context !== 'nutrition' && userData.fitnessGoal) {
      try {
        const nutritionPrompt = `Based on the user's fitness goal of ${userData.fitnessGoal}, provide a brief nutrition tip or suggestion.`;
        const nutritionResponse = await askAI(nutritionPrompt);
        recommendations.push({
          type: 'nutrition',
          message: nutritionResponse.reply
        });
      } catch (error) {
        // If AI fails, add a default recommendation
        recommendations.push({
          type: 'nutrition',
          message: 'Focus on eating whole, unprocessed foods for better results'
        });
      }
    }

    const response = {
      message,
      type: context,
      timestamp: new Date().toISOString(),
      recommendations,
      mood: Math.floor(Math.random() * 5) + 1 // 1-5 mood scale
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in AI reminder API:', error);
    // Return a fallback response
    const fallbackMessage = "You're doing great! Keep up the good work on your fitness journey.";
    return NextResponse.json({
      message: fallbackMessage,
      type: 'fallback',
      timestamp: new Date().toISOString(),
      recommendations: [],
    });
  }
}