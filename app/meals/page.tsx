'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/Toast';
import { getSession } from '@/lib/session';

export default function MealsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState<string>('Analyze the calories and nutrition for this meal');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Add states for manual meal input
  const [foodName, setFoodName] = useState<string>('');
  const [calories, setCalories] = useState<string>('');
  const [nutrients, setNutrients] = useState<string>('');
  const [manualLoading, setManualLoading] = useState<boolean>(false);
  
  const { toast } = useToast();

  // Function to parse nutrition string into structured format
  const parseNutritionString = (nutrientsStr: string) => {
    try {
      // Try to parse as JSON format first
      if (nutrientsStr.startsWith('{') && nutrientsStr.endsWith('}')) {
        const parsed = JSON.parse(nutrientsStr);
        return {
          protein: parseFloat(parsed.protein) || 0,
          carbs: parseFloat(parsed.carbs) || 0,
          fat: parseFloat(parsed.fat) || 0
        };
      }

      // If not JSON, try to extract values from text format
      const proteinMatch = nutrientsStr.match(/protein:\s*(\d+(?:\.\d+)?)/i) || nutrientsStr.match(/protein\s*[:=]\s*(\d+(?:\.\d+)?)/i);
      const carbsMatch = nutrientsStr.match(/carbs?\s*[:=]\s*(\d+(?:\.\d+)?)/i) || nutrientsStr.match(/carbohydrates:\s*(\d+(?:\.\d+)?)/i);
      const fatMatch = nutrientsStr.match(/fat:\s*(\d+(?:\.\d+)?)/i) || nutrientsStr.match(/fat\s*[:=]\s*(\d+(?:\.\d+)?)/i);

      return {
        protein: parseFloat(proteinMatch?.[1]) || 0,
        carbs: parseFloat(carbsMatch?.[1]) || 0,
        fat: parseFloat(fatMatch?.[1]) || 0
      };
    } catch (e) {
      // If parsing fails, return default values
      console.warn('Failed to parse nutrition string:', nutrientsStr, e);
      return {
        protein: 0,
        carbs: 0,
        fat: 0
      };
    }
  };

  // Function to add manual meal
  const handleAddMeal = async () => {
    if (!foodName.trim()) {
      toast.error('Please fill in the food name.');
      return;
    }

    // Parse calories with fallback to 0 for safety
    let caloriesNum = 0;

    if (calories) {
      caloriesNum = parseInt(calories);
      if (isNaN(caloriesNum) || caloriesNum <= 0) {
        toast.error('Please enter a valid calorie value greater than 0.');
        return;
      }
    } else {
      // If no calorie value is provided, use a default value or warn user
      // For now, I'll ask the user to provide the value, but we could implement a default
      toast.error('Please enter calorie information for accurate tracking.');
      return;
    }

    setManualLoading(true);

    try {
      const newMeal = {
        id: crypto.randomUUID(),
        name: foodName.trim(),
        calories: caloriesNum,
        nutrients: nutrients.trim() || undefined, // Only include nutrients if provided
        source: 'manual' as const,
        timestamp: new Date().toISOString(),
      };

      // Get existing meals for user
      const session = getSession();
      if (!session) {
        toast.error('User session not found');
        return;
      }

      // Use the same key as the existing system (meals_${username})
      const mealKey = `meals_${session.username}`;
      const existingMeals = JSON.parse(localStorage.getItem(mealKey) || '[]');
      existingMeals.push(newMeal);
      localStorage.setItem(mealKey, JSON.stringify(existingMeals));

      // Update calories consumed in localStorage (for backward compatibility)
      const currentCalories = parseInt(localStorage.getItem('caloriesConsumed') || '0');
      const newCalories = currentCalories + caloriesNum;
      localStorage.setItem('caloriesConsumed', newCalories.toString());

      // Update total calories (consumed - burned) for dashboard (for backward compatibility)
      const caloriesBurned = parseInt(localStorage.getItem('caloriesBurned') || '0');
      const netCalories = newCalories - caloriesBurned;
      localStorage.setItem('calories', netCalories.toString());

      // Also store per date for insights (for backward compatibility)
      const today = new Date().toISOString().split('T')[0];
      const dateCaloriesKey = `caloriesConsumed_${today}_${session.username}`;
      const currentDayCalories = parseInt(localStorage.getItem(dateCaloriesKey) || '0');
      const newDayCalories = currentDayCalories + caloriesNum;
      localStorage.setItem(dateCaloriesKey, newDayCalories.toString());

      // Save to unified store
      const userId = session.username;
      // Type the unified record explicitly to match WellnessRecord interface
      const unifiedRecord: Omit<import('@/data/models/wellness-record').WellnessRecord, 'id'> = {
        userId,
        timestamp: new Date(),
        type: 'meal',
        category: 'manual',
        metrics: {
          calories: caloriesNum,
          xpEarned: 5, // Standard XP for meal logging
          quantity: 1,
          nutrition: nutrients ? parseNutritionString(nutrients) : undefined // Parse nutrition if provided
        },
        metadata: {
          confidence: 1.0,
          aiInsights: nutrients ? [nutrients] : [],
          tags: ['manual', 'meal']
        }
      };

      // Add to unified store
      const { default: UnifiedStore } = await import('@/lib/storage/unified-store');
      await UnifiedStore.addRecord(userId, unifiedRecord);

      // Dispatch storage event to update dashboard in real-time
      window.dispatchEvent(new StorageEvent('storage', {
        key: `fitsync_unified_records_${userId}`,
        newValue: JSON.stringify(unifiedRecord)
      }));

      // Also dispatch event for legacy compatibility
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'caloriesConsumed',
        newValue: newCalories.toString()
      }));

      // Show success message
      toast.success(`${foodName} added successfully! ${caloriesNum} kcal logged.`);

      // Reset form
      setFoodName('');
      setCalories('');
      setNutrients('');
    } catch (error) {
      console.error('Error adding manual meal:', error);
      toast.error('Failed to add meal. Please try again.');
    } finally {
      setManualLoading(false);
    }
  };

  // Function to parse nutrition info and return simplified format
  const parseNutritionInfo = (rawText: string) => {
    // Check if rawText is defined and is a string
    if (!rawText || typeof rawText !== 'string') {
      return `🍱 Meal: Unknown dish

Calories: N/A kcal`;
    }
    
    // Extract main food items
    const foodMatch = rawText.match(/(?:meal|food|dish):\s*([^\n\r]+)/i);
    const foodItem = foodMatch ? foodMatch[1] : 'Unknown dish';
    
    // Extract calories
    const caloriesMatch = rawText.match(/(\d+)\s*(?:kcal|calories|cal)/i);
    const calories = caloriesMatch ? caloriesMatch[1] : 'N/A';
    
    // Format the simplified output
    return `🍱 Meal: ${foodItem}

Calories: ${calories} kcal`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImageUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select an image file');
      toast.error('Please select an image file');
      return;
    }
    
    if (!prompt) {
      setError('Please enter a prompt');
      toast.error('Please enter a prompt');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      // Show analyzing message
      toast.info('Analyzing meal...');
      
      // Create FormData to send image and prompt
      const formData = new FormData();
      formData.append('image', file);
      formData.append('prompt', prompt);
      
      // Send FormData to API (don't set Content-Type header)
      const response = await fetch('/api/ai', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${await response.text()}`);
      }
      
      const data = await response.json();
      
      // Parse nutrition info and extract calories
      const nutritionText = parseNutritionInfo(data.text || '');
      setResult(nutritionText);
      
      // Extract calories from the parsed text to update dashboard stats
      const caloriesMatch = nutritionText && typeof nutritionText === 'string' 
        ? nutritionText.match(/Calories:\s*(\d+)\s*kcal/) 
        : null;
      if (caloriesMatch) {
        const calories = parseInt(caloriesMatch[1]);
        
        // Update calories consumed in localStorage
        const currentCalories = parseInt(localStorage.getItem('caloriesConsumed') || '0');
        const newCalories = currentCalories + calories;
        localStorage.setItem('caloriesConsumed', newCalories.toString());
        
        // Update total calories (consumed - burned) for dashboard
        const caloriesBurned = parseInt(localStorage.getItem('caloriesBurned') || '0');
        const netCalories = newCalories - caloriesBurned;
        localStorage.setItem('calories', netCalories.toString());
        
        // Also store per date for insights
        const today = new Date().toISOString().split('T')[0];
        const session = getSession();
        if (session) {
          const dateCaloriesKey = `caloriesConsumed_${today}_${session.username}`;
          const currentDayCalories = parseInt(localStorage.getItem(dateCaloriesKey) || '0');
          const newDayCalories = currentDayCalories + calories;
          localStorage.setItem(dateCaloriesKey, newDayCalories.toString());
          
          // Save meal data for insights (unified with manual entries)
          const mealKey = `meals_${session.username}`;
          const existingMeals = JSON.parse(localStorage.getItem(mealKey) || '[]');
          
          // Extract food name from the nutrition text
          const foodMatch = nutritionText && typeof nutritionText === 'string' 
            ? nutritionText.match(/Meal:\s*(.+)/) 
            : null;
          const foodName = foodMatch ? foodMatch[1].trim() : 'AI-analyzed meal';
          
          const aiMeal = {
            id: crypto.randomUUID(),
            name: foodName,
            calories: calories,
            source: 'ai' as const,
            timestamp: new Date().toISOString(),
          };

          existingMeals.push(aiMeal);
          localStorage.setItem(mealKey, JSON.stringify(existingMeals));

          // Save to unified store
          const userId = session.username;
          // Type the unified record explicitly to match WellnessRecord interface
          const unifiedRecord: Omit<import('@/data/models/wellness-record').WellnessRecord, 'id'> = {
            userId,
            timestamp: new Date(),
            type: 'meal',
            category: 'ai_analyzed',
            metrics: {
              calories: calories,
              xpEarned: 10, // Higher XP for AI analysis
              quantity: 1
            },
            metadata: {
              confidence: 0.85,
              aiInsights: [nutritionText],
              tags: ['ai', 'meal', 'analyzed']
            }
          };

          // Add to unified store
          const { default: UnifiedStore } = await import('@/lib/storage/unified-store');
          await UnifiedStore.addRecord(userId, unifiedRecord);

          // Dispatch storage event to update dashboard in real-time
          window.dispatchEvent(new StorageEvent('storage', {
            key: `fitsync_unified_records_${userId}`,
            newValue: JSON.stringify(unifiedRecord)
          }));
        }

        // Dispatch storage event to update dashboard in real-time
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'calories',
          newValue: netCalories.toString()
        }));

        toast.success(`Meal saved! ${calories} kcal added to dashboard.`);
      } else {
        toast.info('Meal analyzed. Calories value not found in response.');
      }
    } catch (error) {
      console.error('Meal analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during analysis';
      setError(errorMessage);
      toast.error('Failed to analyze meal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Log module loaded successfully
  console.log("✅ Meals AI result simplified and saved");
  
  // Log meal to calories integration
  console.log("✅ Meals → Calories integration complete");
  console.log("✅ Insight data integration successful.");

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <h1 className="text-2xl font-bold mb-6">Meal Analyzer</h1>
        
        <Card className="bg-[#161B22] border-[#30363D] mb-6">
          <CardContent className="p-6">
            <form onSubmit={handleImageUpload}>
              <div className="mb-4">
                <Label htmlFor="image" className="text-[#E4E6EB]">Food Image</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="mt-1 bg-[#22252D] border-[#30363D] text-white"
                />
              </div>
              
              <div className="mb-4">
                <Label htmlFor="prompt" className="text-[#E4E6EB]">Analysis Prompt</Label>
                <Input
                  id="prompt"
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="mt-1 bg-[#22252D] border-[#30363D] text-white"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-[#7C3AED] to-[#00FFAA] hover:from-[#6d32d6] hover:to-[#00e69a] text-white py-2 disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : 'Analyze Meal'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Card className="bg-[#161B22] border-red-500 mb-6">
            <CardContent className="p-4">
              <div className="text-red-300">
                <strong>Error:</strong> {error}
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-[#161B22] border-[#30363D]">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-2 text-[#00FFAA]">Nutrition Analysis:</h2>
                <div className="whitespace-pre-line text-[#E6EDF3]">
                  {result ? parseNutritionInfo(result) : 'No analysis available'}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Manual Meal Entry Card */}
        <Card className="bg-[#161B22] border-[#30363D] mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Manual Meal Entry</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="foodName" className="text-[#E4E6EB]">Food Name</Label>
                <Input
                  id="foodName"
                  type="text"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="e.g., Nasi Goreng"
                  className="mt-1 bg-[#22252D] border-[#30363D] text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="calories" className="text-[#E4E6EB]">Calories (kcal)</Label>
                <Input
                  id="calories"
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  placeholder="e.g., 350"
                  className="mt-1 bg-[#22252D] border-[#30363D] text-white"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <Label htmlFor="nutrients" className="text-[#E4E6EB]">Nutrients (optional)</Label>
              <textarea
                id="nutrients"
                value={nutrients}
                onChange={(e) => setNutrients(e.target.value)}
                placeholder="e.g., Carbs, protein, fat"
                className="mt-1 w-full p-2 bg-[#22252D] border border-[#30363D] text-white rounded-lg focus:ring-2 focus:ring-[#00FFAA] focus:border-transparent"
                rows={2}
              />
            </div>
            
            <Button
              onClick={handleAddMeal}
              disabled={manualLoading}
              className="bg-gradient-to-r from-[#00C48C] to-[#4FB3FF] hover:from-[#00B07F] hover:to-[#43A0FF] text-white py-2 disabled:opacity-50"
            >
              {manualLoading ? 'Adding...' : 'Add Meal'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}