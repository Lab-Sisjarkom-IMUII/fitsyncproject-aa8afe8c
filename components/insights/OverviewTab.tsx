'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from 'next-auth/react';
import { getSession } from '@/lib/session';
import { getInsightsData } from '@/lib/storage/unified-aggregator-wrapper';
import InsightLineChart from '@/components/insights/LineChart';
import InsightBarChart from '@/components/insights/BarChart';
import MetricCard from '@/components/insights/MetricCard';
import InsightCard from '@/components/insights/InsightCard';
import { Flame, Footprints, Moon, TrendingUp, Target, Activity } from 'lucide-react';
import { Line } from 'recharts';

interface OverviewTabProps {
  userId?: string;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ userId }) => {
  const { data: session } = useSession();
  const [insightsData, setInsightsData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverviewData = async () => {
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

        const data = await getInsightsData(actualUserId);
        setInsightsData(data);
      } catch (err) {
        console.error('Error fetching overview data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load overview data');
        setInsightsData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOverviewData();
  }, [session, userId]);

  if (loading) {
    return (
      <div className="bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200 p-6">
        <div className="text-center py-8 text-[#8B949E]">Loading overview data...</div>
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

  // Calculate key metrics for the week
  const weekStepsTotal = Array.isArray(insightsData?.week?.steps)
    ? insightsData.week.steps.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;
  const weekCaloriesInTotal = Array.isArray(insightsData?.week?.caloriesIn)
    ? insightsData.week.caloriesIn.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;
  const weekCaloriesOutTotal = Array.isArray(insightsData?.week?.caloriesOut)
    ? insightsData.week.caloriesOut.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;
  const weekNetCaloriesTotal = weekCaloriesInTotal - weekCaloriesOutTotal;
  const weekSleepTotal = Array.isArray(insightsData?.week?.sleepHours)
    ? insightsData.week.sleepHours.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;
  const weekXPTotal = Array.isArray(insightsData?.week?.xp)
    ? insightsData.week.xp.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;

  // Prepare chart data for overview
  const chartData = insightsData?.week?.dates?.map((date: string, index: number) => ({
    name: date,
    steps: insightsData.week.steps?.[index] || 0,
    xp: insightsData.week.xp?.[index] || 0,
    recoveryScore: insightsData.week.recoveryScores?.[index] || 0
  })) || [];

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Steps"
          value={weekStepsTotal.toLocaleString()}
          description="Total steps"
          icon={<Footprints className="h-6 w-6 text-[#00FFAA] mx-auto" />}
        />
        <MetricCard
          title="Calories"
          value={`${weekNetCaloriesTotal >= 0 ? '+' : ''}${weekNetCaloriesTotal}`}
          description="Net calories"
          icon={<Flame className="h-6 w-6 text-[#FF6B6B] mx-auto" />}
          color={weekNetCaloriesTotal >= 0 ? "text-[#FF6B6B]" : "text-[#00FFAA]"}
        />
        <MetricCard
          title="Sleep"
          value={`${weekSleepTotal.toFixed(1)}h`}
          description="Total hours"
          icon={<Moon className="h-6 w-6 text-[#7C3AED] mx-auto" />}
        />
        <MetricCard
          title="XP"
          value={weekXPTotal.toString()}
          description="Experience points"
          icon={<TrendingUp className="h-6 w-6 text-[#4FB3FF] mx-auto" />}
        />
      </div>

      {/* Mini Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightCard title={<><Activity className="inline-block h-5 w-5 mr-2" />Step & XP Trend</>}>
          <InsightLineChart
            data={chartData}
            dataKey="steps"
            title="Steps"
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
          </InsightLineChart>
        </InsightCard>

        <InsightCard title={<><Target className="inline-block h-5 w-5 mr-2" />Recovery Score</>}>
          <InsightBarChart
            data={chartData}
            dataKey="recoveryScore"
            title="Recovery Score"
            color="#FFA726"
          />
        </InsightCard>
      </div>

      {/* Fusion Insights Summary */}
      {insightsData?.recentActivities && insightsData.recentActivities.length > 0 && (
        <InsightCard title="Fusion Highlights">
          <div className="space-y-3">
            <div className="p-3 bg-[#22252D] rounded-lg">
              <h4 className="font-medium text-[#00FFAA] mb-1">Activity-Sleep Correlation</h4>
              <p className="text-sm text-[#E4E6EB]">
                Your recovery score is influenced by {insightsData.recentActivities.length} recent activities.
              </p>
            </div>
            
            {insightsData.week?.nutritionScores && (
              <div className="p-3 bg-[#22252D] rounded-lg">
                <h4 className="font-medium text-[#7C3AED] mb-1">Nutrition Impact</h4>
                <p className="text-sm text-[#E4E6EB]">
                  Average nutrition score: {(insightsData.week.nutritionScores.reduce((sum: number, score: number) => sum + score, 0) / 
                  insightsData.week.nutritionScores.length).toFixed(1)}
                </p>
              </div>
            )}
          </div>
        </InsightCard>
      )}
    </div>
  );
};

export default OverviewTab;