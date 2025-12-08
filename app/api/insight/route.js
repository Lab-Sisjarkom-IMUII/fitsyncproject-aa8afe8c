// app/api/insight/route.js
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { weeklyData, userContext } = await request.json();
    
    const prompt = buildInsightPrompt(weeklyData, userContext);
    
    // Use the existing AI service
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        prompt,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: parseFloat(process.env.AI_DEFAULT_TEMPERATURE || "0.7")
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData?.error || `AI request failed: ${res.status}`);
    }

    const data = await res.json();
    const insight = data.reply;
    
    return NextResponse.json({ 
      insight,
      generatedAt: new Date().toISOString(),
      weekCovered: weeklyData.weekStart || new Date().toISOString().split('T')[0]
    });
    
  } catch (error) {
    console.error('AI Insight generation failed:', error);
    return NextResponse.json(
      { 
        error: 'Insight generation temporarily unavailable', 
        fallback: getFallbackInsight() 
      },
      { status: 503 }
    );
  }
}

function buildInsightPrompt(weeklyData, userContext) {
  return `
You are FitSync AI Coach, an encouraging and knowledgeable fitness assistant. 
Analyze this week's fitness data and provide a SHORT motivational summary (2-3 sentences maximum).

USER CONTEXT:
- Level: ${userContext?.level || 'Beginner'}
- Fitness Goal: ${userContext?.fitnessGoal || 'General Fitness'}
- Current Streak: ${userContext?.currentStreak || 0} days

WEEKLY DATA SUMMARY:
- Total XP: ${weeklyData?.summary?.totalXP || 0}
- Total Steps: ${weeklyData?.summary?.totalSteps || 0}
- Calories Burned: ${weeklyData?.summary?.totalCalories || 0}
- Average Sleep: ${weeklyData?.summary?.avgSleepDuration?.toFixed(1) || 0} hours

SPECIAL INSTRUCTIONS:
- Focus on the MOST impressive achievement this week
- Mention ONE area for gentle improvement (if any)
- Keep it motivational and actionable
- Maximum 3 sentences
- Use enthusiastic but professional tone
- Reference specific numbers when impactful
- Include steps data if available
`;
}

function getFallbackInsight() {
  return "Great progress this week! Keep maintaining your consistency and you'll see amazing results.";
}