export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getInsights, getSummaryStats } from '@/lib/insights';

// In-memory cache for AI responses (keyed by userId:period)
const aiCache = new Map();

// Cache timeout: 10 minutes (600000 ms)
const CACHE_TIMEOUT = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  // For server-side API route, we can't access localStorage directly
  // Return an error message to indicate client-side only
  return NextResponse.json(
    { error: 'Client-side only. Use client-side fetch to get insights data.' },
    { status: 400 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const { period = 'week', regenerate = false, userData } = await request.json();
    
    // Note: In a real server-side implementation, we'd fetch user data from database
    // For now, we'll return an error to indicate this is client-side only
    if (!userData) {
      return NextResponse.json(
        { error: 'User data required. This API should be called from client-side with user data.' },
        { status: 400 }
      );
    }
    
    // Extract user data from the request
    const { session, stats } = userData;
    
    if (!session) {
      return NextResponse.json(
        { error: 'User session required' },
        { status: 401 }
      );
    }
    
    const cacheKey = `${session.username}:${period}`;
    
    // Check cache if not regenerating
    if (!regenerate && aiCache.has(cacheKey)) {
      const cached = aiCache.get(cacheKey);
      if (cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_TIMEOUT) {
        // Make sure the cached data is serializable
        try {
          return NextResponse.json(cached.data);
        } catch (serializeError) {
          console.error('Error serializing cached data:', serializeError);
          // If serialization fails, remove from cache and continue
          aiCache.delete(cacheKey);
        }
      } else {
        // Cache expired, remove it
        aiCache.delete(cacheKey);
      }
    }
    
    // Get summary stats from the provided user data
    const statsData = stats || {
      week: {
        stepsTotal: 0,
        caloriesInTotal: 0,
        caloriesOutTotal: 0,
        netCaloriesTotal: 0,
        sleepTotal: 0,
        xpTotal: 0
      }
    };
    
    // Create AI prompt - explicitly request JSON format
    const prompt = `User: ${session.name || session.username || session.username} (date range: last week)
Weekly summary:
- Steps total: ${statsData.week.stepsTotal}
- Calories in: ${statsData.week.caloriesInTotal} kcal
- Calories out: ${statsData.week.caloriesOutTotal} kcal
- Net calories: ${statsData.week.netCaloriesTotal} kcal
- Total sleep: ${statsData.week.sleepTotal} hours
- XP earned: ${statsData.week.xpTotal}

Task: Generate a short and actionable analysis. Output must contain:
1) Three brief insights (single sentence each) about the user's weekly trend.
2) Three practical recommendations the user can follow next week (each 6-10 words max).
Return JSON object: { "insights": ["...","...","..."], "recommendations": ["...","...","..."] }
Be concise and return valid JSON only.`;

    // Call the AI endpoint
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const aiResponse = await fetch(`${baseUrl}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt,
        model: process.env.AI_MODEL || 'gemini-2.5-flash',
        temperature: parseFloat(process.env.AI_DEFAULT_TEMPERATURE || '0.7')
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI service responded with status ${aiResponse.status}: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    
    // Try to parse the AI response as JSON
    let parsedResponse;
    try {
      // Handle different response formats from AI
      let aiReply;
      if (aiData.text) {
        // If AI returns { success: true, text: "..." } format
        aiReply = aiData.text;
      } else if (aiData.reply) {
        // If AI returns { reply: "..." } format
        aiReply = aiData.reply;
      } else {
        // If AI returns plain text or other format
        aiReply = typeof aiData === 'string' ? aiData : JSON.stringify(aiData);
      }
      
      // If aiReply is already an object, use it directly
      if (typeof aiReply === 'object' && aiReply !== null && !Array.isArray(aiReply)) {
        parsedResponse = aiReply;
      } else {
        // Try to parse as JSON first
        try {
          parsedResponse = JSON.parse(aiReply);
        } catch {
          // If not valid JSON, create structured response
          parsedResponse = {
            insights: [
              "Your activity levels are on track",
              "Calorie intake is within normal range", 
              "Sleep patterns look consistent"
            ],
            recommendations: [
              "Continue current workout routine",
              "Maintain balanced nutrition",
              "Keep sleep schedule regular"
            ]
          };
        }
      }
      
      // Validate that parsedResponse has the expected structure
      if (!parsedResponse.insights || !Array.isArray(parsedResponse.insights)) {
        parsedResponse.insights = [
          "Your activity levels are on track",
          "Calorie intake is within normal range", 
          "Sleep patterns look consistent"
        ];
      }
      
      if (!parsedResponse.recommendations || !Array.isArray(parsedResponse.recommendations)) {
        parsedResponse.recommendations = [
          "Continue current workout routine",
          "Maintain balanced nutrition",
          "Keep sleep schedule regular"
        ];
      }
    } catch (parseError) {
      // If parsing fails, create a fallback response
      console.error('Error parsing AI response:', parseError);
      parsedResponse = {
        insights: [
          "Your activity levels are on track",
          "Calorie intake is within normal range", 
          "Sleep patterns look consistent"
        ],
        recommendations: [
          "Continue current workout routine",
          "Maintain balanced nutrition",
          "Keep sleep schedule regular"
        ]
      };
    }

    // Validate that parsedResponse is serializable before caching
    try {
      // Test serialization
      JSON.stringify(parsedResponse);
      
      // Cache the result
      const cacheEntry = {
        data: parsedResponse,
        timestamp: Date.now()
      };
      
      aiCache.set(cacheKey, cacheEntry);
    } catch (serializeError) {
      console.error('Error serializing response for cache:', serializeError);
      // Don't cache if not serializable
    }

    return NextResponse.json(parsedResponse);
    
  } catch (error) {
    console.error('Error generating AI insights:', error);
    
    // Return fallback insights if AI fails
    const fallbackResponse = {
      insights: [
        "No sufficient data to generate insights",
        "Try logging more activities or meals",
        "Sleep tracking helps complete your profile"
      ],
      recommendations: [
        "Log your meals today",
        "Track your daily steps",
        "Record your sleep hours"
      ]
    };
    
    return NextResponse.json(fallbackResponse, { status: 503 });
  }
}