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
import { Moon, TrendingUp, Activity } from 'lucide-react';
import { Line } from 'recharts';

interface SleepTabProps {
  userId?: string;
}

const SleepTab: React.FC<SleepTabProps> = ({ userId }) => {
  const { data: session } = useSession();
  const [sleepData, setSleepData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSleepData = async () => {
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
        setSleepData(data);
      } catch (err) {
        console.error('Error fetching sleep data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load sleep data');
        setSleepData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSleepData();
  }, [session, userId]);

  if (loading) {
    return (
      <div className="bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200 p-6">
        <div className="text-center py-8 text-[#8B949E]">Loading sleep data...</div>
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

  // Calculate sleep metrics
  const totalSleepHours = Array.isArray(sleepData?.sleepHours)
    ? sleepData.sleepHours.reduce((sum: number, val: number) => (sum + (val || 0)), 0)
    : 0;
  const avgSleepHours = totalSleepHours / 7;

  // Prepare chart data
  const chartData = sleepData?.dates?.map((date: string, index: number) => ({
    name: date,
    sleep: sleepData.sleepHours?.[index] || 0,
    sleepScore: sleepData.sleepScores?.[index] || 0,
    recoveryScore: sleepData.recoveryScores?.[index] || 0
  })) || [];

  return (
    <div className="space-y-6">
      {/* Sleep Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Sleep"
          value={`${totalSleepHours.toFixed(1)}h`}
          description="This week"
          icon={<Moon className="h-6 w-6 text-[#7C3AED] mx-auto" />}
        />
        <MetricCard
          title="Avg. Sleep"
          value={`${avgSleepHours.toFixed(1)}h`}
          description="Per night"
          icon={<Moon className="h-6 w-6 text-[#4FB3FF] mx-auto" />}
        />
        <MetricCard
          title="Avg. Score"
          value={
            sleepData?.sleepScores 
              ? (sleepData.sleepScores.reduce((sum: number, score: number) => sum + score, 0) / sleepData.sleepScores.length).toFixed(1)
              : "0.0"
          }
          description="Sleep quality"
          icon={<TrendingUp className="h-6 w-6 text-[#00FFAA] mx-auto" />}
        />
      </div>

      {/* Sleep Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightCard title={<><Moon className="inline-block h-5 w-5 mr-2" />Sleep Duration</>}>
          <InsightBarChart
            data={chartData}
            dataKey="sleep"
            title="Hours per Night"
            color="#7C3AED"
          >
            {chartData.some((d: any) => d.sleepScore > 0) && (
              <Line
                type="monotone"
                dataKey="sleepScore"
                stroke="#FFA726"
                name="Sleep Score"
                strokeWidth={2}
                yAxisId="right"
              />
            )}
          </InsightBarChart>
        </InsightCard>

        <InsightCard title={<><Activity className="inline-block h-5 w-5 mr-2" />Recovery Score</>}>
          <InsightLineChart
            data={chartData}
            dataKey="recoveryScore"
            title="Recovery Score"
            color="#FFA726"
          />
        </InsightCard>
      </div>

      {/* Sleep Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightCard title="Sleep Patterns">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Consistent Nights</span>
              <span className="text-white font-medium">
                {chartData.filter((d: any) => d.sleep > 0).length}/7
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Best Sleep Night</span>
              <span className="text-white font-medium">
                {sleepData?.dates?.[chartData.findIndex((d: any) => d.sleep === Math.max(...chartData.map((c: any) => c.sleep)))] || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Sleep Consistency</span>
              <span className="text-white font-medium">
                {avgSleepHours >= 7 && avgSleepHours <= 9 ? 'Good' : avgSleepHours > 0 ? 'Needs Improvement' : 'N/A'}
              </span>
            </div>
          </div>
        </InsightCard>

        <InsightCard title="Quality Metrics">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Avg. Sleep Score</span>
              <span className="text-white font-medium">
                {sleepData?.sleepScores 
                  ? (sleepData.sleepScores.reduce((sum: number, score: number) => sum + score, 0) / sleepData.sleepScores.length).toFixed(1)
                  : "0.0"}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Recovery Score</span>
              <span className="text-white font-medium">
                {sleepData?.recoveryScores 
                  ? (sleepData.recoveryScores.reduce((sum: number, score: number) => sum + score, 0) / sleepData.recoveryScores.length).toFixed(1)
                  : "0.0"}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
              <span className="text-[#8B949E]">Optimal Nights</span>
              <span className="text-white font-medium">
                {chartData.filter((d: any) => d.sleep >= 7 && d.sleep <= 9).length}/7
              </span>
            </div>
          </div>
        </InsightCard>
      </div>

      {/* Fusion Insights */}
      {sleepData?.recoveryScores && (
        <InsightCard title="Sleep-Activity Fusion">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-[#22252D] rounded-lg">
              <h4 className="font-medium text-[#00FFAA] mb-1">Activity-Sleep Correlation</h4>
              <p className="text-sm text-[#E4E6EB]">
                Your activity levels influence your sleep patterns. 
                Average recovery score: {(sleepData.recoveryScores.reduce((sum: number, score: number) => sum + score, 0) / sleepData.recoveryScores.length).toFixed(1)}
              </p>
            </div>
            
            {sleepData.nutritionScores && (
              <div className="p-3 bg-[#22252D] rounded-lg">
                <h4 className="font-medium text-[#7C3AED] mb-1">Nutrition Impact</h4>
                <p className="text-sm text-[#E4E6EB]">
                  Your eating patterns affect your sleep quality. 
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

export default SleepTab;