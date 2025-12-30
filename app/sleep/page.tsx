'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSession } from '@/lib/session';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface SleepEntry {
  id: string;
  date: string;
  sleepTime: string;
  wakeTime: string;
  duration: number;
  quality?: 'poor' | 'fair' | 'good' | 'excellent';
  notes?: string;
}

export default function SleepPage() {
  const [sleepStart, setSleepStart] = useState<string>('');
  const [sleepEnd, setSleepEnd] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [sleepQuality, setSleepQuality] = useState<'poor' | 'fair' | 'good' | 'excellent'>('good');
  const [sleepLog, setSleepLog] = useState<SleepEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  // Calculate sleep duration
  const calculateSleepDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    
    const startDate = new Date(`2023-01-01T${start}`);
    const endDate = new Date(`2023-01-01T${end}`);
    
    // Handle overnight sleep (next day)
    if (endDate < startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }
    
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60); // Convert to hours
    
    return parseFloat(diffHrs.toFixed(2));
  };

  // Convert duration in hours to "Xh Ym" format
  const formatDuration = (hours: number): string => {
    const fullHours = Math.floor(hours);
    const minutes = Math.round((hours - fullHours) * 60);
    return `${fullHours}h ${minutes}m`;
  };

  // Load sleep data from localStorage
  useEffect(() => {
    const session = getSession();
    if (session) {
      // Load all sleep entries for this user
      const allKeys = Object.keys(localStorage);
      const sleepEntries: SleepEntry[] = [];
      
      allKeys.forEach(key => {
        if (key.startsWith(`sleep_${session.username}_`)) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data.date && data.sleepTime && data.wakeTime) {
              let durationNum: number;
              
              // Handle both string and numeric duration formats
              if (typeof data.duration === 'string') {
                // Parse the duration string to extract hours and minutes
                const durationMatch = data.duration.match(/(\d+)h\s*(\d+)m/);
                if (durationMatch) {
                  const hours = parseInt(durationMatch[1]);
                  const minutes = parseInt(durationMatch[2]);
                  durationNum = hours + (minutes / 60);
                } else {
                  // If in decimal format already
                  durationNum = parseFloat(data.duration);
                }
              } else if (typeof data.duration === 'number') {
                // Duration is already in numeric format
                durationNum = data.duration;
              } else {
                // Fallback to 0 if duration is invalid
                durationNum = 0;
              }
              
              sleepEntries.push({
                id: key,
                date: data.date,
                sleepTime: data.sleepTime,
                wakeTime: data.wakeTime,
                duration: durationNum,
                quality: data.quality || 'good',
                notes: data.notes || ''
              });
            }
          } catch (e) {
            console.error('Error parsing sleep data:', e);
          }
        }
      });
      
      // Sort by date (newest first)
      const sortedEntries = sleepEntries.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setSleepLog(sortedEntries);
    }
  }, []);

  // Update chart data when sleep log changes
  useEffect(() => {
    // Create chart data with last 7 days of data
    const last7Days = sleepLog.slice(0, 7).map(entry => ({
      date: new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short' }),
      duration: entry.duration,
      dateFull: entry.date
    })).reverse(); // Reverse to show oldest to newest
    
    setChartData(last7Days);
  }, [sleepLog]);

  const handleSaveSleep = async () => {
    if (!sleepStart || !sleepEnd) {
      setError('Please fill in both start and end times');
      return;
    }

    const duration = calculateSleepDuration(sleepStart, sleepEnd);
    const durationString = formatDuration(duration);

    const session = getSession();
    if (session) {
      const date = new Date().toISOString().split('T')[0];
      const sleepEntry: SleepEntry = {
        id: `sleep_${session.username}_${date}`,
        date,
        sleepTime: sleepStart,
        wakeTime: sleepEnd,
        duration,
        quality: sleepQuality,
        notes
      };

      // Store in localStorage with both formats for compatibility
      const sleepEntryForStorage = {
        ...sleepEntry,
        duration: durationString // store as string for compatibility with existing format
      };

      localStorage.setItem(sleepEntry.id, JSON.stringify(sleepEntryForStorage));

      // Update sleep hours for dashboard (store as number)
      localStorage.setItem('sleepHours', duration.toString());

      // Update sleep for insights (store as number)
      localStorage.setItem(`sleep-${date}`, duration.toString());

      // Update state with numeric duration
      setSleepLog(prev => [sleepEntry, ...prev]);

      // Save to unified store
      const userId = session.username;
      const qualityMap = {
        'poor': 0.25,
        'fair': 0.5,
        'good': 0.75,
        'excellent': 1.0
      };

      // Create proper timestamp - combine date with sleep start time for accurate timestamp
      const sleepTimestamp = new Date(`${date}T${sleepStart}:00`);
      
      const unifiedRecord = {
        userId,
        timestamp: sleepTimestamp,
        type: 'sleep' as const,
        category: 'sleep',
        metrics: {
          duration: duration * 60, // Convert hours to minutes for consistency
          xpEarned: 10, // Standard XP for sleep logging
          quality: qualityMap[sleepQuality] || 0.5
        },
        metadata: {
          confidence: 1.0,
          aiInsights: [],
          tags: [`quality_${sleepQuality}`, 'sleep']
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
        key: 'sleepHours',
        newValue: duration.toString()
      }));

      setError(null);

      // Reset form
      setSleepStart('');
      setSleepEnd('');
      setNotes('');
      setSleepQuality('good');
    } else {
      setError('User session not found');
    }
  };

  // Calculate average sleep duration
  const averageSleep = sleepLog.length > 0 
    ? (sleepLog.reduce((sum, entry) => sum + entry.duration, 0) / sleepLog.length).toFixed(2)
    : '0';

  // Calculate recommended sleep (8 hours) vs actual
  const sleepGoalMet = sleepLog.length > 0 ? sleepLog[0].duration >= 8 : false;

  const currentSleepDuration = sleepStart && sleepEnd 
    ? calculateSleepDuration(sleepStart, sleepEnd)
    : 0;

  // Log module loaded successfully
  console.log("✅ Sleep Tracking System with Chart Visualization");
  console.log("✅ Sleep data storage connected to localStorage");
  console.log("✅ Sleep chart data aggregation implemented");

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <h1 className="text-3xl font-bold mb-8">Sleep Tracking</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Sleep Input Card */}
          <div className="lg:col-span-1">
            <Card className="bg-[#161B22] border-[#30363D]">
              <CardHeader>
                <CardTitle className="text-xl">Log Your Sleep</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sleepStart" className="text-[#E4E6EB]">Sleep Start</Label>
                    <Input
                      id="sleepStart"
                      type="time"
                      value={sleepStart}
                      onChange={(e) => setSleepStart(e.target.value)}
                      className="mt-1 bg-[#22252D] border-[#30363D] text-white"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="sleepEnd" className="text-[#E4E6EB]">Wake Up</Label>
                    <Input
                      id="sleepEnd"
                      type="time"
                      value={sleepEnd}
                      onChange={(e) => setSleepEnd(e.target.value)}
                      className="mt-1 bg-[#22252D] border-[#30363D] text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="sleepQuality" className="text-[#E4E6EB]">Sleep Quality</Label>
                  <select
                    id="sleepQuality"
                    value={sleepQuality}
                    onChange={(e) => setSleepQuality(e.target.value as any)}
                    className="w-full p-2 mt-1 bg-[#22252D] border-[#30363D] text-white rounded-lg focus:ring-[#00FFAA] focus:border-[#00FFAA]"
                  >
                    <option value="poor" className="bg-[#22252D] text-white">Poor</option>
                    <option value="fair" className="bg-[#22252D] text-white">Fair</option>
                    <option value="good" className="bg-[#22252D] text-white">Good</option>
                    <option value="excellent" className="bg-[#22252D] text-white">Excellent</option>
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="notes" className="text-[#E4E6EB]">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="How was your sleep?"
                    className="mt-1 bg-[#22252D] border-[#30363D] text-white"
                  />
                </div>
                
                <div className="p-3 bg-[#22252D] border border-[#30363D] rounded">
                  <Label className="text-[#E4E6EB]">Estimated Duration</Label>
                  <div className="text-xl font-bold text-[#00FFAA] mt-1">
                    {currentSleepDuration.toFixed(2)} hours
                  </div>
                </div>
                
                {error && (
                  <div className="p-3 bg-red-500/20 text-red-300 rounded-md text-sm">
                    {error}
                  </div>
                )}
                
                <Button
                  onClick={handleSaveSleep}
                  className="w-full bg-gradient-to-r from-[#7C3AED] to-[#00FFAA] hover:from-[#6d32d6] hover:to-[#00e69a] text-white py-2"
                >
                  Save Sleep Data
                </Button>
              </CardContent>
            </Card>
            
            {/* Sleep Statistics */}
            <Card className="bg-[#161B22] border-[#30363D] mt-6">
              <CardHeader>
                <CardTitle className="text-xl">Sleep Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-[#22252D] rounded-lg">
                    <div className="text-2xl font-bold text-[#00FFAA]">{averageSleep}</div>
                    <div className="text-sm text-[#8B949E]">Avg. Hours</div>
                  </div>
                  <div className="text-center p-4 bg-[#22252D] rounded-lg">
                    <div className="text-2xl font-bold text-[#7C3AED]">{sleepLog.length}</div>
                    <div className="text-sm text-[#8B949E]">Entries</div>
                  </div>
                  <div className="text-center p-4 bg-[#22252D] rounded-lg">
                    <div className="text-2xl font-bold text-[#4FB3FF]">
                      {sleepLog.length > 0 ? sleepLog[0].duration.toFixed(2) : '0.00'}
                    </div>
                    <div className="text-sm text-[#8B949E]">Last Night</div>
                  </div>
                  <div className="text-center p-4 bg-[#22252D] rounded-lg">
                    <div className="text-2xl font-bold text-[#FFA726]">
                      {sleepLog.filter(s => s.duration >= 8).length}
                    </div>
                    <div className="text-sm text-[#8B949E]">Goal Met</div>
                  </div>
                </div>
                
                <div className={`mt-4 p-3 rounded-lg ${sleepGoalMet ? 'bg-[#00C48C]/20 text-[#00C48C]' : 'bg-[#FF6B6B]/20 text-[#FF6B6B]'}`}>
                  <div className="text-center font-medium">
                    {sleepGoalMet 
                      ? '🎉 Great job! You met the recommended 8 hours of sleep!' 
                      : '💡 Aim for 8 hours of sleep for optimal health'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Sleep Chart and Log */}
          <div className="lg:col-span-2 space-y-8">
            {/* Sleep Duration Chart */}
            <Card className="bg-[#161B22] border-[#30363D]">
              <CardHeader>
                <CardTitle className="text-xl">Weekly Sleep Duration</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2D33" />
                      <XAxis dataKey="date" stroke="#A0A3A8" />
                      <YAxis stroke="#A0A3A8" domain={[0, 12]} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#22252D', 
                          borderColor: '#2A2D33', 
                          color: '#E4E6EB',
                          borderRadius: '0.5rem'
                        }} 
                      />
                      <Legend />
                      <Bar dataKey="duration" fill="#00FFAA" name="Hours Slept" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-center text-[#8B949E]">
                    <div>
                      <p className="text-lg">No sleep data available yet</p>
                      <p className="text-sm mt-2">Log your first sleep session to see the chart</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Recent Sleep Log */}
            <Card className="bg-[#161B22] border-[#30363D]">
              <CardHeader>
                <CardTitle className="text-xl">Recent Sleep Log</CardTitle>
              </CardHeader>
              <CardContent>
                {sleepLog.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {sleepLog.map((entry) => (
                      <div 
                        key={entry.id} 
                        className="p-4 bg-[#22252D] border border-[#30363D] rounded-lg"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-[#E6EDF3]">
                              {new Date(entry.date).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </div>
                            <div className="text-sm text-[#8B949E] mt-1">
                              {entry.sleepTime} - {entry.wakeTime} ({entry.duration.toFixed(2)} hours)
                            </div>
                            <div className="text-sm text-[#A0A3A8] mt-1">
                              Quality: <span className="capitalize">{entry.quality}</span>
                            </div>
                            {entry.notes && (
                              <div className="text-sm text-[#E4E6EB] mt-2 italic">
                                "{entry.notes}"
                              </div>
                            )}
                          </div>
                          <div className={`px-2 py-1 rounded text-xs ${
                            entry.duration >= 8 
                              ? 'bg-[#00C48C]/20 text-[#00C48C]' 
                              : 'bg-[#FF6B6B]/20 text-[#FF6B6B]'
                          }`}>
                            {entry.duration >= 8 ? 'Goal Met' : 'Below Goal'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#8B949E]">
                    <p>No sleep data recorded yet</p>
                    <p className="text-sm mt-2">Start by logging your sleep session above</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}