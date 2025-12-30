import { getData, saveData } from './storage';

export async function analyzeMeal(inputType, inputData) {
  // Get API key from environment variables for Gemini (server-side only)
  // IMPORTANT: This function should only be called server-side to avoid exposing the API key
  const apiKey = process.env.GEMINI_API_KEY;

  // Ensure API key is available
  if (!apiKey) {
    console.error("Gemini API key is not set. Please add GEMINI_API_KEY to your environment variables.");
    return { error: "API key not configured", calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  let url, requestBody;

  if (inputType === "text") {
    // For text input, use Gemini Pro
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    
    const prompt = `Analyze this meal description: "${inputData}" and estimate its nutritional values (calories, protein in grams, carbs in grams, fats in grams). Return ONLY the nutritional information in this exact JSON format: {"calories": number, "protein": number, "carbs": number, "fat": number, "mealName": "string"}. Be realistic and conservative in your estimates. Do not include any additional text or explanation, only return the JSON.`;
    
    requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500
      }
    };
  } else if (inputType === "image") {
    // For image input, we'll try to use Gemini Pro Vision (if available in your account)
    // Note: Free tier may not include image analysis
    console.log("Attempting image analysis with Gemini...");
    
    // If user uploads image as base64 data URL, we can try to process it
    // However, this requires Gemini Pro Vision which may not be available in free tier
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;
    
    // For now, we'll show a note that image analysis requires a different approach
    // In a real implementation, you'd need to convert the image to the proper format
    console.warn("Image analysis with Gemini Pro Vision requires a different implementation.");
    
    // For now, return a message indicating that image analysis requires special handling
    return { 
      calories: 0, 
      protein: 0, 
      carbs: 0, 
      fat: 0, 
      mealName: "Image analysis requires special implementation",
      error: "Image analysis with Gemini requires Pro Vision model implementation"
    };
  } else {
    return { 
      calories: 0, 
      protein: 0, 
      carbs: 0, 
      fat: 0, 
      mealName: "Invalid input type",
      error: "Invalid input type provided"
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check for API errors
    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return { 
        calories: 0, 
        protein: 0, 
        carbs: 0, 
        fat: 0, 
        mealName: "API Error",
        error: data.error.message || "Gemini API returned an error"
      };
    }
    
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    try {
      // Try to find and parse the JSON from the response
      const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResult = JSON.parse(jsonMatch[0]);
        return parsedResult;
      } else {
        // If no JSON found in the response, try to extract nutrition values
        console.log("No JSON found in response, attempting to extract from text:", textOutput);
        return extractNutritionFromText(textOutput);
      }
    } catch (parseError) {
      console.warn("Failed to parse API response as JSON, attempting to extract values from text:", textOutput);
      // If JSON parsing fails, try to extract the nutritional values from the text
      return extractNutritionFromText(textOutput);
    }
  } catch (error) {
    console.error("Error analyzing meal:", error);
    // Return default values when API fails
    return { 
      calories: 0, 
      protein: 0, 
      carbs: 0, 
      fat: 0, 
      mealName: "Unknown meal",
      error: error.message 
    };
  }
}

// Helper function to extract nutrition values from text response if JSON parsing fails
function extractNutritionFromText(text) {
  try {
    // Try to find JSON-like structure in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate the parsed result
      if (validateNutritionResult(parsed)) {
        return parsed;
      }
    }
    
    // If no valid JSON found, try to extract values using regex patterns
    const calories = extractNumber(text, /calories?\s*[:=]\s*(\d+)/i) || 0;
    const protein = extractNumber(text, /protein\s*[:=]\s*(\d+)/i) || 0;
    const carbs = extractNumber(text, /carbs?\s*[:=]\s*(\d+)/i) || 0;
    const fat = extractNumber(text, /fat\s*[:=]\s*(\d+)/i) || 0;
    const mealName = extractMealName(text);

    const result = { 
      calories, 
      protein, 
      carbs, 
      fat, 
      mealName: mealName || "Unknown meal"
    };
    
    // Validate the extracted result
    if (validateNutritionResult(result)) {
      return result;
    }
    
    // If no values found, return default values
    console.warn("Could not extract nutrition data from response:", text);
    return { 
      calories: 0, 
      protein: 0, 
      carbs: 0, 
      fat: 0, 
      mealName: "Unknown meal",
      textOutput: text,
      error: "Unable to extract nutrition values from AI response"
    };
  } catch (e) {
    console.warn("Error extracting nutrition from text:", e);
    return { 
      calories: 0, 
      protein: 0, 
      carbs: 0, 
      fat: 0, 
      mealName: "Unknown meal",
      textOutput: text,
      error: e.message
    };
  }
}

// Helper function to validate nutrition result
function validateNutritionResult(result) {
  if (!result || typeof result !== 'object') {
    return false;
  }
  
  // Check if required fields exist and are non-negative numbers
  const requiredFields = ['calories', 'protein', 'carbs', 'fat'];
  for (const field of requiredFields) {
    if (typeof result[field] !== 'number' || result[field] < 0 || isNaN(result[field])) {
      return false;
    }
  }
  
  // Check bounds for realistic nutrition values
  if (result.calories > 10000 || result.protein > 500 || result.carbs > 500 || result.fat > 500) {
    return false; // Values seem unrealistic
  }
  
  return true;
}

// Helper function to extract numbers from text using regex
function extractNumber(text, regex) {
  const match = text.match(regex);
  if (match && match[1]) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? null : num;
  }
  return null;
}

// Helper function to extract meal name from text
function extractMealName(text) {
  // Look for meal name in the response
  const nameMatch = text.match(/mealName\s*["']?\s*[:=]\s*["']([^"']+)["']/i);
  if (nameMatch && nameMatch[1]) {
    return nameMatch[1];
  }
  return null;
}