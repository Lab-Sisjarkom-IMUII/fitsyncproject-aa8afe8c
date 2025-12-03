'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from 'next-auth/react';
import { getSession } from '@/lib/session';
import { getWeeklyStats } from '@/lib/storage/unified-aggregator-wrapper';
import InsightLineChart from '@/components/insights/LineChart';
import InsightBarChart from '@/components/insights/BarChart';
import MetricCard from '@/components/insights/MetricCard';
import InsightCard from '@/components/insights/InsightCard';
import { Flame, Utensils, Target } from 'lucide-react';
import { Line } from 'recharts';

interface NutritionTabProps {
  userId?: string;
}

const NutritionTab: React.FC<NutritionTabProps> = ({ userId }) => {
  const { data: session } = useSession();
  const [nutritionData, setNutritionData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNutritionData = async () => {
      try {
        setLoading(true);
        setError(null);

        let actualUserId = userId;
        if (!actualUserId) {
          if (session && session.user) {
            actualUserId = session.user.email || session.user.name || 'default_user';
          } else {
            const fallbackSession = getSession();
            actualUserId = fallbackSession?.username || 'default_user';
          }
        }

        if (!actualUserId) {
          throw new Error('User ID not available');
        }

        const data = await getWeeklyStats(actualUserId);
        setNutritionData(data);
      } catch (err) {
        console.error('Error fetching nutrition data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load nutrition data');
        setNutritionData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNutritionData();
  }, [session, userId]);

  if (loading) {
    return (
      <div className="bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200 p-6">
        <div className="text-center py-8 text-[#8B949E]">Loading nutrition data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200 p-6">
        <div className="text-center py-8 text-[#FF6B6B]">{error}</div>
      </div>
    );
  }

  // Calculate nutrition metrics
  const totalCaloriesIn = Array.isArray(nutritionData?.caloriesIn)
    ? nutritionData.caloriesIn.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;
  const totalCaloriesOut = Array.isArray(nutritionData?.caloriesOut)
    ? nutritionData.caloriesOut.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;
  const netCalories = totalCaloriesIn - totalCaloriesOut;

  // Prepare chart data
  const chartData = nutritionData?.dates?.map((date: string, index: number) => ({
    name: date,
    caloriesIn: nutritionData.caloriesIn?.[index] || 0,
    caloriesOut: nutritionData.caloriesOut?.[index] || 0,
    netCalories: (nutritionData.caloriesIn?.[index] || 0) - (nutritionData.caloriesOut?.[index] || 0),
    nutritionScore: nutritionData.nutritionScores?.[index] || 0,
    mealQualityTrend: nutritionData.mealQualityTrends?.[index] || 0
  })) || [];

  return (
    <div className="space-y-6">
      {/* Nutrition Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Calories In"
          value={totalCaloriesIn.toLocaleString()}
          description="Consumed"
          icon={<Flame className="h-6 w-6 text-[#00FFAA] mx-auto" />}
        />
        <MetricCard
          title="Calories Out"
          value={totalCaloriesOut.toLocaleString()}
          description="Burned"
          icon={<Flame className="h-6 w-6 text-[#FF6B6B] mx-auto" />}
        />
        <MetricCard
          title="Net Calories"
          value={`${netCalories >= 0 ? '+' : ''}${netCalories}`}
          description="Balance"
          icon={<Target className="h-6 w-6 text-[#4FB3FF] mx-auto" />}
          color={netCalories >= 0 ? "text-[#FF6B6B]" : "text-[#00FFAA]"}
        />
        <MetricCard
          title="Avg. Score"
          value={
            nutritionData?.nutritionScores 
              ? (nutritionData.nutritionScores.reduce((sum: number, score: number) => sum + score, 0) / nutritionData.nutritionScores.length).toFixed(1)
              : "0.0"
          }
          description="Nutrition quality"
          icon={<Utensils className="h-6 w-6 text-[#FFA726] mx-auto" />}
        />
      </div>

      {/* Nutrition Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightCard title={<><Flame className="inline-block h-5 w-5 mr-2" />Calories Trend</>}>
          <InsightLineChart
            data={chartData}
            dataKey="caloriesIn"
            title="Calories In"
            color="#00FFAA"
          >
            <Line
              type="monotone"
              dataKey="caloriesOut"
              stroke="#FF6B6B"
              name="Calories Out"
              strokeWidth={2}
              yAxisId="right"
            />
            <Line
              type="monotone"
              dataKey="netCalories"
              stroke="#4FB3FF"
              name="Net Calories"
              strokeWidth={2}
              yAxisId="right"
            />
          </InsightLineChart>
        </InsightCard>

        <InsightCard title={<><Utensils className="inline-block h-5 w-5 mr-2" />Nutrition Quality</>}>
          <InsightBarChart
            data={chartData}
            dataKey="nutritionScore"
            title="Nutrition Score"
            color="#FFA726"
          >
            {chartData.some((d: any) => d.mealQualityTrend > 0) && (
              <Line
                type="monotone"
                dataKey="mealQualityTrend"
                stroke="#BA68C8"
                name="Meal Quality Trend"
                strokeWidth={2}
                yAxisId="right"
              />
            )}
          </InsightBarChart>
        </InsightCard>
      </div>

      {/* Meal Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightCard title="Meal Patterns">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Avg. Meals/Day</span>
              <span className="text-white font-medium">
                {(totalCaloriesIn / 7 / 500).toFixed(1)} {/* Assuming avg 500 calories per meal */}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Consistent Days</span>
              <span className="text-white font-medium">
                {chartData.filter((d: any) => d.caloriesIn > 0).length}/7
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Peak Nutrition Day</span>
              <span className="text-white font-medium">
                {nutritionData?.dates?.[chartData.findIndex((d: any) => d.nutritionScore === Math.max(...chartData.map((c: any) => c.nutritionScore)))] || 'N/A'}
              </span>
            </div>
          </div>
        </InsightCard>

        <InsightCard title="Calorie Balance">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Avg. Daily Intake</span>
              <span className="text-white font-medium">
                {(totalCaloriesIn / 7).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Daily Goal Met</span>
              <span className="text-white font-medium">
                {chartData.filter((d: any) => d.caloriesIn > 0).length}/7
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Balance Score</span>
              <span className="text-white font-medium">
                {netCalories < 0 ? 'Negative' : 'Positive'}
              </span>
            </div>
          </div>
        </InsightCard>
      </div>

      {/* Fusion Insights */}
      {nutritionData?.mealQualityTrends && (
        <InsightCard title="Nutrition-Sleep Fusion">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-[#22252D] rounded-lg">
              <h4 className="font-medium text-[#00FFAA] mb-1">Meal Timing</h4>
              <p className="text-sm text-[#E4E6EB]">
                Your meal timing patterns can impact your sleep quality. 
                Average meal quality trend: {(nutritionData.mealQualityTrends.reduce((sum: number, score: number) => sum + score, 0) / nutritionData.mealQualityTrends.length).toFixed(1)}
              </p>
            </div>
            
            {nutritionData.sleepScores && (
              <div className="p-3 bg-[#22252D] rounded-lg">
                <h4 className="font-medium text-[#7C3AED] mb-1">Sleep Connection</h4>
                <p className="text-sm text-[#E4E6EB]">
                  Your nutrition choices affect your sleep patterns. 
                  Correlation data available through fusion engine.
                </p>
              </div>
            )}
          </div>
        </InsightCard>
      )}
    </div>
  );
};

export default NutritionTab;