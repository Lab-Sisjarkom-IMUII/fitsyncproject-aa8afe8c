'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, Play, Star, Utensils, Flame, Moon, TrendingUp, User, Bell, Sun, MoonIcon, ChevronRight } from 'lucide-react'
import { useXp } from '@/context/XpContext'
import { getUserProfile } from '@/lib/userProfile'
import { getSession } from '@/lib/session'
import StepsTracker from '@/components/dashboard/StepsTracker'
import WeeklyActivitySummary from '@/components/dashboard/WeeklyActivitySummary'
import ActivityFeed from '@/components/activity/ActivityFeed'
import WeeklyActivityChart from '@/components/activity/WeeklyActivityChart'
import { MiniAISummary } from '@/components/dashboard/mini-ai-summary'
import MiniCharts from '@/components/dashboard/MiniCharts'
import DailyCardSummary from '@/components/dashboard/DailyCardSummary'
import TrendCardGrid from '@/components/dashboard/TrendCardGrid';
import { useTrendData } from '@/hooks/useTrendData';
import InstallPWAButton from '@/components/pwa/InstallPWAButton';

export default function DashboardPage() {
  console.log('[DASHBOARD PAGE] Component mounted, current path:', typeof window !== 'undefined' ? window.location.pathname : 'server');

  const { data: session, status } = useSession()
  const router = useRouter()
  const { xp, level, updateXp } = useXp()

  const [stats, setStats] = useState({
    steps: 0,
    goalSteps: 10000,
    calories: 0,
    caloriesConsumed: 0,
    caloriesBurned: 0,
    netCalories: 0,
    sleep: 0,
    xp: xp,
    level: level
  })

  // Load trend data using the new hook
  // Use consistent userId format to match how data is stored (prioritize session.username)
  let userId = 'default_user';
  if (session && session.user) {
    // Check if session has username property (from localStorage sync) - matches how data is stored
    const userWithUsername = session.user;
    userId = userWithUsername.username || session.user.email || session.user.name || 'default_user';
  } else {
    const fallbackSession = getSession();
    userId = fallbackSession?.username || 'default_user';
  }
  const { trendData, loading: trendLoading, error: trendError, reload: reloadTrendData } = useTrendData({ userId });
  const [activities, setActivities] = useState([]);
  const [aiInsight, setAiInsight] = useState('');
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)

  // Check for demo session in localStorage
  const [demoSession, setDemoSession] = useState(null);

  useEffect(() => {
    setIsClient(true);
    
    const sessionData = getSession();
    
    // Set demo session to null since we're removing demo sessions
    setDemoSession(null);
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined' && isClient) {
      // Check authentication status first
      const isAuthenticated = (status === 'authenticated') || (getSession() !== null && getSession() !== undefined);

      if (!isAuthenticated) {
        // If not authenticated, redirect to login
        console.log('No authenticated session in dashboard, redirecting to login');
        router.push('/auth/login');
        return;
      }

      // If authenticated, check if onboarding is completed
      const profile = getUserProfile();
      console.log('Checking profile in dashboard:', profile);

      // Redirect to onboarding if:
      // 1. No profile exists (first time user after login)
      // 2. Profile exists but onboarding is not completed
      console.log('[DASHBOARD] Checking profile onboarding status:', {
        profileExists: !!profile,
        profileOnboardingCompleted: profile?.onboardingCompleted,
        profileName: profile?.name,
        profileAge: profile?.age,
        profileGender: profile?.gender,
        profileHeight: profile?.height,
        profileWeight: profile?.weight
      });

      // Only redirect to onboarding if profile doesn't exist at all OR onboarding is not completed
      // Don't redirect if user has already completed onboarding, even if some optional fields are missing
      if (!profile || !profile.onboardingCompleted) {
        console.log('[DASHBOARD] Profile missing or onboarding not completed, redirecting to onboarding', {
          profileExists: !!profile,
          onboardingCompleted: profile?.onboardingCompleted,
          hasName: !!profile?.name,
          hasAge: !!profile?.age,
          hasGender: !!profile?.gender,
          hasHeight: !!profile?.height,
          hasWeight: !!profile?.weight
        });
        // Prevent redirect loop - only redirect if still on dashboard page
        if (router.pathname === '/dashboard' || router.pathname === '/dashboard/') {
          router.push('/onboarding');
        }
        return; // Early return to avoid further execution when redirecting
      }

      console.log('[DASHBOARD] Onboarding completed, proceeding to fetch data');
      fetchUserData();
      fetchActivities();
    }
  }, [status, isClient]); // Removed router.pathname to prevent loop - only check on status/client changes

  // Add effect to listen for changes in localStorage and update stats
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
        fetchUserData();
        fetchActivities();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isClient]); // Removed fetchUserData and fetchActivities from dependencies to avoid circular reference

  const fetchUserData = async () => {
    try {
      // Use unified data store instead of individual localStorage keys
      const session = getSession();
      const userId = session?.username || 'default_user';

      // Get today's aggregated data from unified store
      const todayData = await import('@/lib/storage/unified-store').then(mod => mod.default.getDailyAggregatedData(userId));

      // Get goal steps from localStorage (still use legacy for goals)
      const goalSteps = localStorage.getItem('goalSteps') ? parseInt(localStorage.getItem('goalSteps')) : 10000;

      // Get XP from unified store
      const currentXp = await import('@/lib/xp/xp-system').then(mod => mod.default.getXp(userId));
      const currentLevel = await import('@/lib/xp/xp-system').then(mod => mod.default.getLevel(userId));

      // Get AI insights from unified aggregator
      try {
        const { default: UnifiedAggregator } = await import('@/lib/storage/unified-aggregator');
        const summaryStats = await UnifiedAggregator.getSummaryStats(userId);

        // Generate basic AI insight based on current data with null safety
        let insightText = "Keep up the good work! ";

        if (summaryStats?.today?.caloriesOut > 300) {
          insightText += "You're burning good calories today. ";
        }
        if (summaryStats?.today?.steps > 8000) {
          insightText += "Great job with your steps! ";
        }
        if (summaryStats?.today?.sleepHours >= 7) {
          insightText += "Good sleep logged today. ";
        }

        if (summaryStats?.today?.caloriesOut <= 100 &&
            summaryStats?.today?.steps <= 2000 &&
            summaryStats?.today?.sleepHours < 6) {
          insightText = "It looks like a quiet day today. Consider taking a short walk to get your body moving!";
        }

        setAiInsight(insightText);
      } catch (insightError) {
        console.error('Error generating AI insight:', insightError);
        setAiInsight("Start tracking your activities to get personalized insights!");
      }

      // Update state with unified data
      setStats({
        steps: todayData.totals.steps,
        goalSteps: goalSteps,
        calories: todayData.totals.caloriesConsumed - todayData.totals.caloriesBurned, // Kept for compatibility
        caloriesConsumed: todayData.totals.caloriesConsumed,
        caloriesBurned: todayData.totals.caloriesBurned,
        netCalories: todayData.totals.caloriesConsumed - todayData.totals.caloriesBurned,
        sleep: todayData.totals.sleepHours,
        xp: currentXp,
        level: currentLevel
      });
    } catch (error) {
      console.error('Error fetching user data from unified store:', error);

      // Fallback to legacy data if unified store fails
      try {
        const steps = localStorage.getItem('steps') ? parseInt(localStorage.getItem('steps')) : 0;
        const goalSteps = localStorage.getItem('goalSteps') ? parseInt(localStorage.getItem('goalSteps')) : 10000;
        const caloriesConsumed = localStorage.getItem('caloriesConsumed') ? parseInt(localStorage.getItem('caloriesConsumed')) : 0;
        const caloriesBurned = localStorage.getItem('caloriesBurned') ? parseInt(localStorage.getItem('caloriesBurned')) : 0;
        const sleep = localStorage.getItem('sleepHours') ? parseFloat(localStorage.getItem('sleepHours')) : 0;

        // Calculate net calories (consumed - burned)
        const netCalories = caloriesConsumed - caloriesBurned;

        setStats({
          steps: steps,
          goalSteps: goalSteps,
          calories: netCalories, // Kept for compatibility
          caloriesConsumed: caloriesConsumed,
          caloriesBurned: caloriesBurned,
          netCalories: netCalories,
          sleep: sleep,
          xp: xp,
          level: level
        });

        // Set a default insight when using fallback data
        setAiInsight("Start tracking your activities to get personalized insights!");
      } catch (fallbackError) {
        console.error('Error in fallback data fetching:', fallbackError);
        setStats({
          steps: 0,
          goalSteps: 10000,
          calories: 0,
          caloriesConsumed: 0,
          caloriesBurned: 0,
          netCalories: 0,
          sleep: 0,
          xp: xp,
          level: level
        });

        setAiInsight("No data available. Start tracking your activities to get insights!");
      }
    } finally {
      setLoading(false);
    }
  }

  const fetchActivities = async () => {
    try {
      const session = getSession();
      if (session) {
        const activitiesData = JSON.parse(localStorage.getItem(`activities_${session.username}`) || '[]');
        // Sort activities by date, most recent first
        const sortedActivities = activitiesData.sort((a, b) => 
          new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp)
        );
        setActivities(sortedActivities);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-2xl text-white">Loading...</div>
      </div>
    )
  }

  if (status === 'loading' && !getSession()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-2xl text-white">Loading...</div>
      </div>
    )
  }

  // Allow rendering if there's a valid session
  if (!session && !getSession()) {
    return null
  }

  // Calculate step progress percentage
  const stepProgress = Math.min(100, (stats.steps / stats.goalSteps) * 100);

  const DashboardHeader = () => {
    const profile = getUserProfile();
    const currentSession = getSession();

    if (!profile) {
      const hour = new Date().getHours();
      const timeGreeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
      return (
        <header className="bg-[#161B22] rounded-2xl p-6 mb-6 border border-[#30363D]">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-[#E6EDF3]">
                {timeGreeting}, {currentSession?.name || session?.user?.name || 'Friend'} 👋
              </h1>
              <p className="text-[#8B949E] mt-1">Set up your fitness goals to get started</p>
            </div>
          </div>
          <Button 
            className="mt-4 bg-gradient-to-r from-[#00C48C] to-[#4FB3FF] hover:from-[#00B07F] hover:to-[#43A0FF] text-white"
            onClick={() => router.push('/onboarding')}
          >
            Complete Onboarding
          </Button>
        </header>
      );
    }

    const goalLabel = profile.goalType === "lose" 
      ? "Lose" 
      : profile.goalType === "gain" 
        ? "Gain" 
        : "Maintain";

    const diff = Math.abs(profile.targetWeight - profile.weight);

    return (
      <header className="bg-gradient-to-r from-[#00C48C]/10 to-[#4FB3FF]/10 rounded-2xl p-6 mb-6 border border-[#30363D]">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-[#E6EDF3]">
              Welcome back, {profile.name || currentSession?.name || session?.user?.name || 'Friend'} 👋
            </h1>
            <p className="text-[#8B949E] mt-1">
              {goalLabel} {diff.toFixed(1)}kg in {profile.targetDuration} weeks
            </p>
            <div className="mt-3 flex items-center text-sm">
              <span className="text-[#8B949E]">Activity level:</span>
              <span className="ml-2 px-2 py-1 bg-[#00C48C]/20 text-[#00C48C] rounded-full">
                {profile.activityLevel === 'sedentary' && 'Sedentary'}
                {profile.activityLevel === 'light' && 'Light'}
                {profile.activityLevel === 'moderate' && 'Moderate'}
                {profile.activityLevel === 'active' && 'Active'}
                {profile.activityLevel === 'very-active' && 'Very Active'}
              </span>
            </div>
          </div>
          <Button 
            variant="outline"
            className="border-[#30363D] text-[#E6EDF3] hover:bg-[#0D1117]"
            onClick={() => router.push('/onboarding')}
          >
            Edit Goals
          </Button>
        </div>
      </header>
    );
  };

  // Log module loaded successfully
  console.log("✅ Dashboard calorie system synced");

  // Log all system updates
  console.log("✅ Dashboard calorie system updated with net calories calculation");
  console.log("✅ Insight data integration successful.");

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <DashboardHeader />
        <InstallPWAButton />
        {/* Hero Metrics Section */}
        {stats.steps === 0 && stats.calories === 0 && stats.sleep === 0 ? (
          <div className="mb-6 p-6 bg-[#161B22] border border-[#30363D] rounded-2xl text-center">
            <h2 className="text-xl font-bold text-[#E6EDF3] mb-2">Welcome to Your Fitness Journey!</h2>
            <p className="text-[#8B949E] mb-4">Start tracking your activities to see your progress here.</p>
            <Button 
              onClick={() => router.push('/activities')}
              className="bg-gradient-to-r from-[#00C48C] to-[#4FB3FF] hover:from-[#00B07F] hover:to-[#43A0FF] text-white"
            >
              Start Tracking
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* XP Progress Card */}
            <Card className="bg-[#161B22] border-[#30363D] p-4 rounded-2xl shadow-md transition-all duration-200 flex flex-col min-h-[100px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm text-[#8B949E]">Level</h3>
                <TrendingUp className="h-4 w-4 text-[#00C48C]" />
              </div>
              <p className="text-2xl font-bold text-[#E6EDF3]">{level}</p>
              <p className="text-xs text-[#8B949E]">XP: {xp}</p>
              <div className="flex-grow"></div>
            </Card>

            {/* Steps Card */}
            <Card className="bg-[#161B22] border-[#30363D] p-4 rounded-2xl shadow-md transition-all duration-200 flex flex-col min-h-[100px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm text-[#8B949E]">Steps</h3>
                <Activity className="h-4 w-4 text-[#00C48C]" />
              </div>
              <p className="text-2xl font-bold text-[#E6EDF3]">{stats.steps.toLocaleString()}</p>
              <div className="w-full bg-[#0D1117] rounded-full h-1.5 mt-2">
                <div
                  className="bg-gradient-to-r from-[#00C48C] to-[#4FB3FF] h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${stepProgress}%` }}
                ></div>
              </div>
              <div className="flex-grow"></div>
            </Card>

            {/* Calories Card */}
            <Card className="bg-[#161B22] border-[#30363D] p-4 rounded-2xl shadow-md transition-all duration-200 flex flex-col min-h-[100px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm text-[#8B949E]">Calories</h3>
                <Flame className="h-4 w-4 text-[#00C48C]" />
              </div>
              <p className="text-2xl font-bold text-[#E6EDF3]">{stats.netCalories}</p>
              <p className="text-xs text-[#8B949E]">net kcal</p>
              <div className="flex-grow"></div>
            </Card>

            {/* Sleep Card */}
            <Card className="bg-[#161B22] border-[#30363D] p-4 rounded-2xl shadow-md transition-all duration-200 flex flex-col min-h-[100px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm text-[#8B949E]">Sleep</h3>
                <Moon className="h-4 w-4 text-[#00C48C]" />
              </div>
              <p className="text-2xl font-bold text-[#E6EDF3]">{stats.sleep}h</p>
              <p className="text-xs text-[#8B949E]">quality hrs</p>
              <div className="flex-grow"></div>
            </Card>
          </div>
      )}
      
      {/* Weekly Trends Section */}
      <div className="mb-6">
        {typeof window !== 'undefined' && (
          // Only render MiniCharts on the client side
          <MiniCharts userId={session?.user?.email || session?.user?.name || 'default_user'} />
        )}
      </div>

      {/* 7-Day Trend Cards Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#E6EDF3]">7-Day Trends</h2>
          <Button
            size="sm"
            variant="outline"
            className="bg-[#22252D] border-[#30363D] text-white hover:bg-[#2A2D33] rounded-lg"
            onClick={reloadTrendData}
          >
            Refresh
          </Button>
        </div>

        {trendLoading ? (
          <div className="text-center py-4 text-[#8B949E]">Loading trend data...</div>
        ) : trendError ? (
          <div className="text-center py-4 text-[#FF6B6B]">{trendError}</div>
        ) : trendData ? (
          <TrendCardGrid trendData={trendData} />
        ) : (
          <div className="text-center py-4 text-[#8B949E]">No trend data available</div>
        )}
      </div>

      {/* Daily Summary Section */}
      <div className="mb-6">
        {typeof window !== 'undefined' && (
          // Only render DailyCardSummary on the client side
          <DailyCardSummary userId={session?.user?.email || session?.user?.name || 'default_user'} />
        )}
      </div>

      {/* Activity Tracking Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <StepsTracker />
        <WeeklyActivitySummary />
      </div>

      {/* Activity Feed and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#E6EDF3] mb-4">Recent Activity Feed</h2>
          <ActivityFeed limit={3} activities={activities} onDelete={(id) => {
            // Handle delete in dashboard context if needed
            // For now, just rely on the storage event to update
          }} />
        </div>
        <WeeklyActivityChart activities={activities} />
      </div>
      
      {/* Today's Workout Card */}
        <Card className="bg-[#161B22] border-[#30363D] mb-6 overflow-hidden rounded-2xl shadow-md transition-all duration-200">
          <div className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-[#E6EDF3]">Today's Workout</h2>
                <p className="text-[#8B949E]">Upper Body Strength</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#8B949E]">45 min</p>
                <p className="text-xs text-[#8B949E]">Intermediate</p>
              </div>
            </div>
            
            <div className="bg-[#0D1117] rounded-lg p-4 mb-4">
              <div className="flex justify-between text-sm text-[#E6EDF3] mb-2">
                <span>Push-ups</span>
                <span>3 sets × 12 reps</span>
              </div>
              <div className="flex justify-between text-sm text-[#E6EDF3] mb-2">
                <span>Dumbbell Rows</span>
                <span>3 sets × 10 reps</span>
              </div>
              <div className="flex justify-between text-sm text-[#E6EDF3]">
                <span>Shoulder Press</span>
                <span>3 sets × 10 reps</span>
              </div>
            </div>
            
            <Button 
              className="w-full bg-gradient-to-r from-[#00C48C] to-[#4FB3FF] hover:from-[#00B07F] hover:to-[#43A0FF] py-6 text-lg rounded-xl"
              onClick={() => router.push('/activities')}
            >
              <Play className="h-5 w-5 mr-2" />
              Track Activity
            </Button>
          </div>
        </Card>

        {/* Mini AI Summary Card */}
        <MiniAISummary />

        {/* Weekly Trends Card */}
        <Card className="bg-[#161B22] border-[#30363D] p-5 mb-6 rounded-2xl shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#E6EDF3]">Weekly Progress</h2>
            <Button variant="ghost" size="sm" className="text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#0D1117]">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-[#8B949E] mb-1">
                <span>XP Trend</span>
                <span className="text-[#00C48C]">+12%</span>
              </div>
              <div className="w-full bg-[#0D1117] rounded-full h-2">
                <div className="bg-[#00C48C] h-2 rounded-full" style={{ width: '65%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm text-[#8B949E] mb-1">
                <span>Calories</span>
                <span className="text-[#00C48C]">-5%</span>
              </div>
              <div className="w-full bg-[#0D1117] rounded-full h-2">
                <div className="bg-[#00C48C] h-2 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm text-[#8B949E] mb-1">
                <span>Sleep</span>
                <span className="text-[#00C48C]">+8%</span>
              </div>
              <div className="w-full bg-[#0D1117] rounded-full h-2">
                <div className="bg-[#00C48C] h-2 rounded-full" style={{ width: '80%' }}></div>
              </div>
            </div>
          </div>
        </Card>

        {/* Goals & Progress Card */}
        <Card className="bg-[#161B22] border-[#30363D] p-5 rounded-2xl shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#E6EDF3]">Today's Goals</h2>
            <Button variant="ghost" size="sm" className="text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#0D1117]">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#0D1117] rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-[#00C48C] mr-3"></div>
                <span className="text-[#E6EDF3]">Drink 2L Water</span>
              </div>
              <span className="text-sm text-[#8B949E]">80%</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-[#0D1117] rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-[#4FB3FF] mr-3"></div>
                <span className="text-[#E6EDF3]">Complete Workout</span>
              </div>
              <span className="text-sm text-[#8B949E]">Pending</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-[#0D1117] rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-[#00C48C] mr-3"></div>
                <span className="text-[#E6EDF3]">Log Meal</span>
              </div>
              <span className="text-sm text-[#8B949E]">2/3</span>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}