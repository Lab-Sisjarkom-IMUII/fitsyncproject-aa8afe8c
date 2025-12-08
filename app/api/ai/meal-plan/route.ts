// app/api/ai/meal-plan/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { askAI } from "@/lib/aiService";
import { prompts } from "@/lib/aiPrompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['calories'];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Create user object from request body
    const user = {
      calories: body.calories,
      dietaryRestrictions: body.dietaryRestrictions || [],
      foodPreferences: body.foodPreferences || [],
      activityLevel: body.activityLevel || 3,
      fitnessGoal: body.fitnessGoal || 'maintain_weight',
      name: body.name || 'User'
    };

    // Generate the prompt using our template
    const prompt = prompts.mealPlan(user);

    // Call the AI service
    const response = await askAI(prompt);

    // Try to parse the AI response as JSON
    let parsedResponse;
    try {
      // Extract JSON from the response if it's wrapped in markdown or other text
      const jsonMatch = response.reply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No valid JSON found in AI response");
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.log("Raw AI response:", response.reply);
      
      // Return a generic error response
      return NextResponse.json(
        { 
          error: "Failed to parse meal plan from AI response",
          rawResponse: response.reply
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error("Error in meal plan API:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate meal plan",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}