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
import { Footprints, Flame, TrendingUp, Activity } from 'lucide-react';
import { Line } from 'recharts';

interface ActivityTabProps {
  userId?: string;
}

const ActivityTab: React.FC<ActivityTabProps> = ({ userId }) => {
  const { data: session } = useSession();
  const [activityData, setActivityData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivityData = async () => {
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
        setActivityData(data);
      } catch (err) {
        console.error('Error fetching activity data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load activity data');
        setActivityData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityData();
  }, [session, userId]);

  if (loading) {
    return (
      <div className="bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200 p-6">
        <div className="text-center py-8 text-[#8B949E]">Loading activity data...</div>
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

  // Calculate activity metrics
  const totalSteps = Array.isArray(activityData?.steps)
    ? activityData.steps.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;
  const totalXP = Array.isArray(activityData?.xp)
    ? activityData.xp.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;
  const totalCaloriesOut = Array.isArray(activityData?.caloriesOut)
    ? activityData.caloriesOut.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;

  // Prepare chart data
  const chartData = activityData?.dates?.map((date: string, index: number) => ({
    name: date,
    steps: activityData.steps?.[index] || 0,
    xp: activityData.xp?.[index] || 0,
    caloriesOut: activityData.caloriesOut?.[index] || 0,
    recoveryScore: activityData.recoveryScores?.[index] || 0
  })) || [];

  return (
    <div className="space-y-6">
      {/* Activity Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard
          title="Steps"
          value={totalSteps.toLocaleString()}
          description="Total steps"
          icon={<Footprints className="h-6 w-6 text-[#00FFAA] mx-auto" />}
        />
        <MetricCard
          title="Calories"
          value={totalCaloriesOut.toLocaleString()}
          description="Calories burned"
          icon={<Flame className="h-6 w-6 text-[#FF6B6B] mx-auto" />}
        />
        <MetricCard
          title="XP"
          value={totalXP.toString()}
          description="Experience points"
          icon={<TrendingUp className="h-6 w-6 text-[#4FB3FF] mx-auto" />}
        />
      </div>

      {/* Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightCard title={<><Activity className="inline-block h-5 w-5 mr-2" />Daily Steps</>}>
          <InsightBarChart
            data={chartData}
            dataKey="steps"
            title="Steps per Day"
            color="#00FFAA"
          >
            {chartData.some((d: any) => d.xp > 0) && (
              <Line
                type="monotone"
                dataKey="xp"
                stroke="#4FB3FF"
                name="XP"
                strokeWidth={2}
                yAxisId="right"
              />
            )}
          </InsightBarChart>
        </InsightCard>

        <InsightCard title={<><Flame className="inline-block h-5 w-5 mr-2" />Calories Burned</>}>
          <InsightLineChart
            data={chartData}
            dataKey="caloriesOut"
            title="Calories Out"
            color="#FF6B6B"
          />
        </InsightCard>
      </div>

      {/* Activity Consistency & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightCard title="Activity Consistency">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Active Days</span>
              <span className="text-white font-medium">
                {chartData.filter((d: any) => d.steps > 0).length}/7
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Avg. Daily Steps</span>
              <span className="text-white font-medium">
                {(totalSteps / 7).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Peak Day</span>
              <span className="text-white font-medium">
                {activityData?.dates?.[chartData.findIndex((d: any) => d.steps === Math.max(...chartData.map((c: any) => c.steps)))] || 'N/A'}
              </span>
            </div>
          </div>
        </InsightCard>

        <InsightCard title="Performance Trends">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Recovery Score</span>
              <span className="text-white font-medium">
                {(activityData?.recoveryScores?.reduce((sum: number, score: number) => sum + score, 0) / (activityData?.recoveryScores?.length || 1)).toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Activity Streak</span>
              <span className="text-white font-medium">
                {chartData.filter((d: any, i: number) => d.steps > 0 && i > 0 && chartData[i-1].steps > 0).length || 0} days
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Avg. XP/Day</span>
              <span className="text-white font-medium">
                {(totalXP / 7).toFixed(0)}
              </span>
            </div>
          </div>
        </InsightCard>
      </div>

      {/* Fusion Insights */}
      {activityData?.recoveryScores && (
        <InsightCard title="Activity-Sleep Fusion">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-[#22252D] rounded-lg">
              <h4 className="font-medium text-[#00FFAA] mb-1">Recovery Score</h4>
              <p className="text-sm text-[#E4E6EB]">
                Your recovery is influenced by your activity levels and sleep patterns. 
                Average score: {(activityData.recoveryScores.reduce((sum: number, score: number) => sum + score, 0) / activityData.recoveryScores.length).toFixed(1)}
              </p>
            </div>
            
            {activityData.nutritionScores && (
              <div className="p-3 bg-[#22252D] rounded-lg">
                <h4 className="font-medium text-[#7C3AED] mb-1">Nutrition Impact</h4>
                <p className="text-sm text-[#E4E6EB]">
                  Your activity performance is supported by your nutrition quality. 
                  Average nutrition score: {(activityData.nutritionScores.reduce((sum: number, score: number) => sum + score, 0) / activityData.nutritionScores.length).toFixed(1)}
                </p>
              </div>
            )}
          </div>
        </InsightCard>
      )}
    </div>
  );
};

export default ActivityTab;