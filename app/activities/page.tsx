'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSession } from '@/lib/session';
import { useToast } from '@/components/ui/Toast';
import { useXp } from '@/context/XpContext';
import AddActivityForm from '@/components/activity/AddActivityForm';
import QuickLogButtons from '@/components/activity/QuickLogButtons';
import ActivityCard from '@/components/activity/ActivityCard';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { xp, level, updateXp } = useXp();

  // Load activities from localStorage on component mount
  useEffect(() => {
    const session = getSession();
    if (session) {
      const activitiesData = JSON.parse(localStorage.getItem(`activities_${session.username}`) || '[]');
      setActivities(activitiesData);
    }
  }, []);

  // Function to add a new activity
  const handleAddActivity = async (activity) => {
    try {
      const session = getSession();
      if (!session) {
        setError('User session not found');
        toast.error('User session not found');
        return;
      }

      // Prepare activity for storage
      const activityEntry = {
        ...activity,
        calories_burned: activity.calories, // Use the calculated calories from our form
        timestamp: activity.date // Use the timestamp from our form
      };

      const updatedActivities = [...activities, activityEntry];
      setActivities(updatedActivities);
      localStorage.setItem(`activities_${session.username}`, JSON.stringify(updatedActivities));

      // Save to unified store
      const userId = session.username;
      // Type the unified record explicitly to match WellnessRecord interface
      const unifiedRecord: Omit<import('@/data/models/wellness-record').WellnessRecord, 'id'> = {
        userId,
        timestamp: new Date(activity.date || Date.now()),
        type: 'activity', // Fixed: Use fixed 'activity' type
        category: activity.type,
        metrics: {
          duration: activity.duration,
          calories: activity.calories,
          xpEarned: activity.xp || 0,
          intensity: activity.intensity || 5,
          quantity: activity.type === 'walking' || activity.type === 'running'
            ? Math.round(activity.duration * 100) // Estimate steps
            : undefined
        },
        metadata: {
          confidence: 1.0,
          aiInsights: activity.aiInsights || [],
          tags: [activity.type, `intensity_${activity.intensity}`]
        }
      };

      // Add to unified store
      const { default: ClientSafeUnifiedStore } = await import('@/lib/storage/client-safe-unified-store');
      await ClientSafeUnifiedStore.addRecord(userId, unifiedRecord);

      // Dispatch storage event to update dashboard in real-time
      window.dispatchEvent(new StorageEvent('storage', {
        key: `fitsync_unified_records_${userId}`,
        newValue: JSON.stringify(unifiedRecord)
      }));

      // Also dispatch event for legacy compatibility
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'caloriesBurned',
        newValue: activity.calories.toString()
      }));

      // Also dispatch event for steps if needed
      if (activity.type === 'walking' || activity.type === 'running') {
        const estimatedSteps = Math.round(activity.duration * 100);
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'steps',
          newValue: estimatedSteps.toString()
        }));
      }

      toast.success(`Activity logged successfully! Earned ${activity.xp} XP.`);

      // Update XP context (this will also update the unified store through the new XpContext)
      updateXp(activity.xp, `activity_${activity.type}`);
    } catch (err) {
      setError('Failed to save activity');
      toast.error('Failed to save activity. Please try again.');
      console.error('Error saving activity:', err);
    }
  };

  // Function to handle quick log of an activity
  const handleQuickLog = (activity) => {
    handleAddActivity(activity);
  };

  // Function to delete an activity
  const handleDeleteActivity = (activityId) => {
    try {
      const session = getSession();
      if (!session) {
        setError('User session not found');
        toast.error('User session not found');
        return;
      }

      // Filter out the activity to be deleted
      const updatedActivities = activities.filter(activity => activity.id !== activityId);
      setActivities(updatedActivities);
      localStorage.setItem(`activities_${session.username}`, JSON.stringify(updatedActivities));

      // For deletion, we need to recalculate totals from all remaining activities
      // This is complex, so let's just recalculate from scratch
      let totalSteps = 0;
      let totalCalories = 0;
      
      // Recalculate from all remaining activities
      updatedActivities.forEach(activity => {
        if (activity.type === 'walking' || activity.type === 'running') {
          const estimatedSteps = Math.round(activity.duration * 100);
          totalSteps += estimatedSteps;
        }
        totalCalories += activity.calories || activity.calories_burned || 0;
      });

      // Update localStorage
      localStorage.setItem('steps', totalSteps.toString());
      localStorage.setItem('caloriesBurned', totalCalories.toString());

      // Update net calories (consumed - burned)
      const caloriesConsumed = parseInt(localStorage.getItem('caloriesConsumed') || '0');
      const netCalories = caloriesConsumed - totalCalories;
      localStorage.setItem('calories', netCalories.toString());

      // Dispatch storage events to update dashboard
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'calories',
        newValue: netCalories.toString()
      }));
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'steps',
        newValue: totalSteps.toString()
      }));

      toast.success('Activity deleted successfully.');
    } catch (err) {
      setError('Failed to delete activity');
      toast.error('Failed to delete activity. Please try again.');
      console.error('Error deleting activity:', err);
    }
  };

  // Calculate total steps and calories burned
  const totalSteps = activities
    .filter(activity => activity.type === 'walking' || activity.type === 'running')
    .reduce((sum, activity) => sum + (Math.round(activity.duration * 100) || 0), 0);

  const totalCaloriesBurned = activities
    .reduce((sum, activity) => sum + (activity.calories || activity.calories_burned || 0), 0);

  // Log module loaded successfully
  console.log("✅ Phase 15 Activity Tracking System fully integrated");
  console.log("✅ Activity XP calculation and tracking enabled");
  console.log("✅ Quick log buttons and enhanced activity forms implemented");
  
  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <h1 className="text-2xl font-bold mb-6">Activities Tracking</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Activity Form Column */}
          <div className="lg:col-span-2">
            <Card className="bg-[#161B22] border-[#30363D]">
              <CardContent className="p-6">
                <AddActivityForm onAddActivity={handleAddActivity} />
                <QuickLogButtons onQuickLog={handleQuickLog} />
              </CardContent>
            </Card>
          </div>
          
          {/* Stats Summary Column */}
          <div className="space-y-6">
            <Card className="bg-[#161B22] border-[#30363D]">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Today's Summary</h2>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-[#8B949E]">Total Steps</p>
                      <p className="text-2xl font-bold text-[#E6EDF3]">{totalSteps.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#8B949E]">XP Level</p>
                      <p className="text-2xl font-bold text-[#4FB3FF]">{level}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <div>
                      <p className="text-[#8B949E]">Calories Burned</p>
                      <p className="text-2xl font-bold text-[#00FFAA]">{totalCaloriesBurned} kcal</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#8B949E]">All XP</p>
                      <p className="text-2xl font-bold text-[#4FB3FF]">{xp}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Quick Stats */}
            <Card className="bg-[#161B22] border-[#30363D]">
              <CardContent className="p-6">
                <h3 className="font-medium text-[#E6EDF3] mb-3">Weekly Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-[#0D1117] rounded">
                    <p className="text-lg font-bold text-[#00C48C]">{activities.length}</p>
                    <p className="text-xs text-[#8B949E]">Activities</p>
                  </div>
                  <div className="text-center p-2 bg-[#0D1117] rounded">
                    <p className="text-lg font-bold text-[#FFA726]">{Math.round(totalCaloriesBurned / 7)}</p>
                    <p className="text-xs text-[#8B949E]">Daily Avg</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Activities Card */}
        <Card className="bg-[#161B22] border-[#30363D]">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Activities</h2>
              <span className="text-sm text-[#8B949E]">{activities.length} total</span>
            </div>
            
            {activities.length > 0 ? (
              <div className="space-y-4">
                {activities.slice().reverse().map((activity, index) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onDelete={handleDeleteActivity}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-[#8B949E] mb-4">No activities logged yet</p>
                <p className="text-sm text-[#6E7681]">Start by logging your first activity using the form</p>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="mt-4 p-3 bg-red-500/20 text-red-300 rounded-md">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}