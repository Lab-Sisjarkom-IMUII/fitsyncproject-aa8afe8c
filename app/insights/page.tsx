'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Brain, TrendingUp, Flame, Moon, RotateCcw,
  Activity, Utensils, Footprints, Calendar,
  ArrowUp, ArrowDown, Target
} from 'lucide-react';
import { useXp } from '@/context/XpContext';
import { getSession } from '@/lib/session';
import UnifiedAggregator from '@/lib/storage/unified-aggregator-wrapper';
// Import new components
import InsightCard from '@/components/insights/InsightCard';
import MetricCard from '@/components/insights/MetricCard';
import EmptyState from '@/components/insights/EmptyState';
import TrendVisualizer from '@/components/insights/TrendVisualizer';
// Import tab components
import OverviewTab from '@/components/insights/OverviewTab';
import ActivityTab from '@/components/insights/ActivityTab';
import NutritionTab from '@/components/insights/NutritionTab';
import SleepTab from '@/components/insights/SleepTab';

export default function WeeklyInsightsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { xp, level } = useXp();
  const [insightsData, setInsightsData] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, activity, nutrition, sleep

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Ref for the timeout ID
  const debouncedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchInsightsData = async () => {
    setIsLoading(true);
    console.log('[INSIGHTS] fetchInsightsData - start');
    try {
      // Use unified aggregator instead of legacy insights function
      // Get consistent userId - prioritize session.username to match data storage
      let sessionUserId;
      if (session && session.user) {
        // Try to match the format used when saving data (session.username)
        // session.user might have username property if synced from localStorage
        const userWithUsername = session.user as any;
        sessionUserId = userWithUsername.username || session.user.email || session.user.name || 'default_user';
      } else {
        // Fallback - only if absolutely needed
        try {
          // Only try async fallback if session is not available
          const { getSession: asyncGetSession } = await import('@/lib/session');
          const fallbackSession = await asyncGetSession();
          sessionUserId = fallbackSession?.username || 'default_user';
        } catch (e) {
          sessionUserId = 'default_user';
          console.warn('[INSIGHTS] Could not get user ID, using default');
        }
      }

      const userId = sessionUserId;
      console.log('[INSIGHTS] Fetching insights data for user:', userId);
      console.log('[INSIGHTS] Session data:', { 
        hasSession: !!session, 
        username: (session?.user as any)?.username,
        email: session?.user?.email,
        name: session?.user?.name 
      });

      // Verify correct import of unified aggregator
      // Use named exports for direct access
      const { getWeeklyStats, getDailyStats, getInsightsData } = await import('@/lib/storage/unified-aggregator-wrapper');

      // Fetch data using unified aggregator
      let weeklyStats = null;
      try {
        if (getWeeklyStats) {
          weeklyStats = await getWeeklyStats(userId);
          console.log('[INSIGHTS] Weekly Stats Loaded:', weeklyStats);
          console.log('[INSIGHTS] Weekly Stats structure:', {
            hasDates: Array.isArray(weeklyStats?.dates),
            datesLength: weeklyStats?.dates?.length,
            hasSteps: Array.isArray(weeklyStats?.steps),
            stepsLength: weeklyStats?.steps?.length
          });
        }
      } catch (e) {
        console.error('[INSIGHTS] Error fetching weekly stats:', e);
        console.error('[INSIGHTS] Weekly stats error stack:', e.stack);
      }

      // Also get insights data using the named export if available
      let data;
      try {
        if (getInsightsData) {
          data = await getInsightsData(userId);
        } else {
          // Fallback to default import's method
          data = await UnifiedAggregator.getInsightsData(userId);
        }
        console.log('[INSIGHTS] UnifiedAggregator Data loaded:', !!data);
        console.log('[INSIGHTS] UnifiedAggregator Data structure:', {
          hasWeek: !!data?.week,
          hasToday: !!data?.today,
          weekDates: data?.week?.dates?.length,
          weekSteps: data?.week?.steps?.length
        });
      } catch (e) {
        console.error('[INSIGHTS] Error fetching insights data:', e);
        console.error('[INSIGHTS] Insights data error stack:', e.stack);
      }

      console.log('[INSIGHTS] Final data:', data);

      // Validate data structure
      if (data && data.week) {
        console.log('[INSIGHTS] Week data structure:', {
          dates: data.week.dates?.length,
          steps: data.week.steps?.length,
          caloriesIn: data.week.caloriesIn?.length,
          caloriesOut: data.week.caloriesOut?.length,
          sleepHours: data.week.sleepHours?.length,
          xp: data.week.xp?.length
        });
      }

      setInsightsData(data);
    } catch (error) {
      console.error('[INSIGHTS] fetch error', error);
      console.error('[INSIGHTS] fetch error stack', error.stack);
      // Fail safe - set empty data to avoid crashes
      setInsightsData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced fetchInsightsData function to prevent rapid multiple calls
  const debouncedFetchInsightsData = useCallback(() => {
    // Clear the previous timeout if it exists
    if (debouncedTimeoutRef.current) {
      clearTimeout(debouncedTimeoutRef.current);
    }

    // Set a new timeout to call fetchInsightsData after 300ms
    debouncedTimeoutRef.current = setTimeout(() => {
      fetchInsightsData();
    }, 300);
  }, [fetchInsightsData]);

  useEffect(() => {
    if (!isClient) return;
    if (status === 'loading') return;

    console.log('[INSIGHTS] isClient,status,session:', isClient, status, !!session);

    if (status === 'unauthenticated' && !session) {
      router.push('/auth/login');
      return;
    }

    // now safe to fetch
    debouncedFetchInsightsData();
  }, [isClient, status, session, router, debouncedFetchInsightsData]);

  // Add effect to listen for changes in unified store and update insights
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Listen for any storage changes related to wellness data
      if (isClient && (
        e.key?.includes('fitsync_unified') ||
        e.key?.includes('activities_') ||
        e.key?.includes('meals_') ||
        e.key?.includes('sleep_') ||
        e.key?.includes('steps') ||
        e.key?.includes('calories') ||
        e.key?.includes('fitsync_xp')
      )) {
        console.log('Detected storage change, refreshing insights data');
        debouncedFetchInsightsData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isClient, debouncedFetchInsightsData]);

  // Cleanup the timeout on unmount
  useEffect(() => {
    return () => {
      if (debouncedTimeoutRef.current) {
        clearTimeout(debouncedTimeoutRef.current);
      }
    };
  }, []);


  const generateAIInsights = async () => {
    setIsGeneratingInsight(true);
    try {
      // Get current user session and stats from unified aggregator
      if (session && session.user) {
        const userId = session.user.email || session.user.name || 'default_user';
        console.log('Generating AI insights for user:', userId);
        const unifiedModule = await import('@/lib/storage/unified-aggregator-wrapper');
        const getSummaryStats = unifiedModule.getSummaryStats;
        const stats = getSummaryStats ?
          await getSummaryStats(userId) :
          await UnifiedAggregator.getSummaryStats(userId);
        console.log('Generated summary stats:', stats);

        // Send request to API with user data
        const response = await fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            period: 'week',
            userData: {
              session: session,
              stats: stats
            }
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate AI insights');
        }

        const data = await response.json();
        console.log('Received AI insights:', data);
        setAiInsights(data);
      }
    } catch (error) {
      console.error('Error generating AI insights:', error);
      // Set fallback insights
      setAiInsights({
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
      });
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading insights...</div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading insights...</div>
      </div>
    );
  }

  if (!session && status === 'unauthenticated') {
    return null;
  }

  if (isLoading && !insightsData) {
    return (
      <div className="min-h-screen bg-[#0D1117] text-white">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-xl">Loading insights data...</div>
          </div>
        </main>
      </div>
    );
  }

  // Calculate weekly totals for summary
  const weekStepsTotal = insightsData?.week?.steps?.reduce((sum, val) => sum + val, 0) || 0;
  const weekCaloriesInTotal = insightsData?.week?.caloriesIn?.reduce((sum, val) => sum + val, 0) || 0;
  const weekCaloriesOutTotal = insightsData?.week?.caloriesOut?.reduce((sum, val) => sum + val, 0) || 0;
  const weekNetCaloriesTotal = weekCaloriesInTotal - weekCaloriesOutTotal;
  const weekSleepTotal = insightsData?.week?.sleepHours?.reduce((sum, val) => sum + val, 0) || 0;
  const weekXPTotal = insightsData?.week?.xp?.reduce((sum, val) => sum + val, 0) || 0;

  // Check if there's any activity data
  const hasActivityData = weekStepsTotal > 0 ||
                          weekCaloriesInTotal > 0 ||
                          weekCaloriesOutTotal > 0 ||
                          weekSleepTotal > 0 ||
                          weekXPTotal > 0;

  // Prepare chart data for all tabs
  const chartData = insightsData ? insightsData.week.dates.map((date, index) => ({
    name: date,
    steps: insightsData.week.steps[index],
    caloriesIn: insightsData.week.caloriesIn[index],
    caloriesOut: insightsData.week.caloriesOut[index],
    netCalories: insightsData.week.caloriesIn[index] - insightsData.week.caloriesOut[index],
    sleep: insightsData.week.sleepHours[index],
    xp: insightsData.week.xp[index],
    // Include new fusion fields if available
    nutritionScore: insightsData.week.nutritionScores ? insightsData.week.nutritionScores[index] : 0,
    sleepScore: insightsData.week.sleepScores ? insightsData.week.sleepScores[index] : 0,
    recoveryScore: insightsData.week.recoveryScores ? insightsData.week.recoveryScores[index] : 0,
    mealQualityTrend: insightsData.week.mealQualityTrends ? insightsData.week.mealQualityTrends[index] : 0
  })) : [];

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Weekly Progress Insights</h1>
              <p className="text-[#A0A3A8]">Analyze your fitness journey with data-driven insights</p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={debouncedFetchInsightsData}
                variant="outline"
                className="flex items-center gap-2 bg-[#22252D] border-[#30363D] text-white hover:bg-[#2A2D33]"
              >
                <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 mt-4 p-1 bg-[#161B22] rounded-lg w-fit">
            {['overview', 'activity', 'nutrition', 'sleep'].map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-[#22252D] text-white shadow-sm'
                    : 'text-[#8B949E] hover:text-white'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* 7-Day Trend Visualizer - Now at the top */}
        <div className="mb-8">
          <TrendVisualizer userId={session?.user?.email || session?.user?.name || 'default_user'} />
        </div>

        {/* Key Metrics Grid - Original layout */}
        {!hasActivityData ? (
          <div className="mb-8 p-6 bg-[#161B22] border border-[#30363D] rounded-2xl text-center">
            <h3 className="text-lg font-medium text-white mb-2">No Activity Data Found</h3>
            <p className="text-[#8B949E] mb-4">Start tracking your workouts, meals, steps, or sleep to get insights.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => router.push('/dashboard')}
                className="bg-gradient-to-r from-[#7C3AED] to-[#00FFAA] hover:from-[#6d32d6] hover:to-[#00e69a] text-white"
              >
                Go to Dashboard
              </Button>
              <Button
                onClick={() => router.push('/activities')}
                variant="outline"
                className="border-[#30363D] text-white hover:bg-[#22252D]"
              >
                Log Activities
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* Net Calories Card */}
            <Card className="p-4 text-center bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200">
              <Flame className="h-6 w-6 text-[#FF6B6B] mx-auto mb-2" />
              <h3 className="text-sm font-medium text-[#8B949E]">Net Calories</h3>
              <div className="flex items-center justify-center gap-1">
                <p className={`text-xl font-bold ${weekNetCaloriesTotal >= 0 ? 'text-[#FF6B6B]' : 'text-[#00FFAA]'}`}>
                  {weekNetCaloriesTotal >= 0 ? '+' : ''}{weekNetCaloriesTotal}
                </p>
                <span className="text-xs text-[#8B949E]">kcal</span>
              </div>
            </Card>

            {/* Steps Card */}
            <Card className="p-4 text-center bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200">
              <Footprints className="h-6 w-6 text-[#00FFAA] mx-auto mb-2" />
              <h3 className="text-sm font-medium text-[#8B949E]">Steps</h3>
              <p className="text-xl font-bold text-white">{weekStepsTotal.toLocaleString()}</p>
            </Card>

            {/* Sleep Hours Card */}
            <Card className="p-4 text-center bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200">
              <Moon className="h-6 w-6 text-[#7C3AED] mx-auto mb-2" />
              <h3 className="text-sm font-medium text-[#8B949E]">Sleep Hours</h3>
              <p className="text-xl font-bold text-white">{weekSleepTotal.toFixed(1)}h</p>
            </Card>

            {/* XP Card */}
            <Card className="p-4 text-center bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200">
              <TrendingUp className="h-6 w-6 text-[#4FB3FF] mx-auto mb-2" />
              <h3 className="text-sm font-medium text-[#8B949E]">XP Earned</h3>
              <p className="text-xl font-bold text-white">{weekXPTotal}</p>
            </Card>
          </div>
        )}

        {/* Tab Content Section */}
        {hasActivityData && insightsData ? (
          <div className="mb-8">
            {/* Render different tab content based on active tab */}
            {activeTab === 'overview' && <OverviewTab userId={session?.user?.email || session?.user?.name || 'default_user'} />}
            {activeTab === 'activity' && <ActivityTab userId={session?.user?.email || session?.user?.name || 'default_user'} />}
            {activeTab === 'nutrition' && <NutritionTab userId={session?.user?.email || session?.user?.name || 'default_user'} />}
            {activeTab === 'sleep' && <SleepTab userId={session?.user?.email || session?.user?.name || 'default_user'} />}
          </div>
        ) : null}

        {/* AI Smart Analysis Box - Now at the bottom */}
        <Card className="mb-8 bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#22252D] rounded-full flex items-center justify-center border border-[#30363D]">
                <Brain className="w-4 h-4 text-[#00FFAA]" />
              </div>
              <div>
                <CardTitle className="text-white">AI Smart Analysis</CardTitle>
                <p className="text-sm text-[#8B949E]">Personalized insights and recommendations</p>
              </div>
              <Button
                onClick={generateAIInsights}
                disabled={isGeneratingInsight}
                variant="outline"
                size="sm"
                className="ml-auto bg-[#22252D] border-[#30363D] text-white hover:bg-[#2A2D33] rounded-lg"
              >
                {isGeneratingInsight ? 'Generating...' : 'Generate Insight'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-[#22252D] rounded p-4 border border-[#30363D]">
              {aiInsights ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-[#00FFAA] mb-2">Insights</h4>
                    <ul className="space-y-1">
                      {aiInsights.insights?.map((insight, index) => (
                        <li key={index} className="text-[#E4E6EB] flex items-start">
                          <span className="mr-2">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-[#7C3AED] mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {aiInsights.recommendations?.map((recommendation, index) => (
                        <li key={index} className="text-[#E4E6EB] flex items-start">
                          <span className="mr-2">•</span>
                          <span>{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[#8B949E]">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#30363D] border-t-[#00FFAA]"></div>
                  Click "Generate Insight" to analyze your week
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Statistics Grid - Only shown when there's activity data */}
        {hasActivityData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly Summary */}
            <Card className="bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Weekly Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
                    <span className="text-[#8B949E]">Avg. Steps</span>
                    <span className="text-white font-medium">
                      {Math.round(weekStepsTotal / 7).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
                    <span className="text-[#8B949E]">Avg. Calories</span>
                    <span className="text-white font-medium">
                      {Math.round(weekCaloriesInTotal / 7)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
                    <span className="text-[#8B949E]">Avg. Sleep</span>
                    <span className="text-white font-medium">
                      {(weekSleepTotal / 7).toFixed(1)}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-[#22252D] rounded-lg">
                    <span className="text-[#8B949E]">Avg. XP</span>
                    <span className="text-white font-medium">
                      {Math.round(weekXPTotal / 7)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Trends */}
            <Card className="bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-[#8B949E] mb-1">
                      <span>Steps Consistency</span>
                      <span className="text-[#00FFAA] flex items-center">
                        <ArrowUp className="h-3 w-3 mr-1" />
                        +12%
                      </span>
                    </div>
                    <div className="w-full bg-[#0D1117] rounded-full h-2">
                      <div className="bg-[#00FFAA] h-2 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm text-[#8B949E] mb-1">
                      <span>Calorie Balance</span>
                      <span className="text-[#FF6B6B] flex items-center">
                        <ArrowDown className="h-3 w-3 mr-1" />
                        -5%
                      </span>
                    </div>
                    <div className="w-full bg-[#0D1117] rounded-full h-2">
                      <div className="bg-[#FF6B6B] h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm text-[#8B949E] mb-1">
                      <span>Sleep Quality</span>
                      <span className="text-[#00FFAA] flex items-center">
                        <ArrowUp className="h-3 w-3 mr-1" />
                        +8%
                      </span>
                    </div>
                    <div className="w-full bg-[#0D1117] rounded-full h-2">
                      <div className="bg-[#00FFAA] h-2 rounded-full" style={{ width: '75%' }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weekly Goals */}
            <Card className="bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Weekly Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[#22252D] rounded-lg">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-[#00FFAA] mr-3"></div>
                      <span className="text-[#E4E6EB]">10,000 Steps</span>
                    </div>
                    <span className="text-sm text-[#8B949E]">5/7</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#22252D] rounded-lg">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-[#FF6B6B] mr-3"></div>
                      <span className="text-[#E4E6EB]">2000 kcal</span>
                    </div>
                    <span className="text-sm text-[#8B949E]">7/7</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#22252D] rounded-lg">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-[#4FB3FF] mr-3"></div>
                      <span className="text-[#E4E6EB]">8 hours sleep</span>
                    </div>
                    <span className="text-sm text-[#8B949E]">4/7</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#22252D] rounded-lg">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-[#7C3AED] mr-3"></div>
                      <span className="text-[#E4E6EB]">Log meals</span>
                    </div>
                    <span className="text-sm text-[#8B949E]">2/7</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}