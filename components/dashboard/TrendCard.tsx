'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Activity, Flame, Moon, TrendingUp, Footprints } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendDataPoint {
  date: string;
  value: number;
}

interface TrendCardProps {
  title: string;
  value: string | number;
  unit?: string;
  data: TrendDataPoint[];
  trendDirection: 'up' | 'down' | 'stable';
  changePercentage: number;
  metricType: 'steps' | 'caloriesIn' | 'caloriesOut' | 'sleep' | 'xp';
}

const TrendCard = ({ 
  title, 
  value, 
  unit, 
  data, 
  trendDirection, 
  changePercentage,
  metricType 
}: TrendCardProps) => {
  // Get metric icon based on type
  const getMetricIcon = () => {
    switch (metricType) {
      case 'steps':
        return <Footprints className="h-5 w-5 text-[#00FFAA]" />;
      case 'caloriesIn':
        return <Flame className="h-5 w-5 text-[#FF6B6B]" />;
      case 'caloriesOut':
        return <Activity className="h-5 w-5 text-[#4FB3FF]" />;
      case 'sleep':
        return <Moon className="h-5 w-5 text-[#7C3AED]" />;
      case 'xp':
        return <TrendingUp className="h-5 w-5 text-[#4FB3FF]" />;
      default:
        return <TrendingUp className="h-5 w-5 text-[#A0A3A8]" />;
    }
  };

  // Get metric color based on type
  const getMetricColor = () => {
    switch (metricType) {
      case 'steps':
        return '#00FFAA';
      case 'caloriesIn':
        return '#FF6B6B';
      case 'caloriesOut':
        return '#4FB3FF';
      case 'sleep':
        return '#7C3AED';
      case 'xp':
        return '#4FB3FF';
      default:
        return '#A0A3A8';
    }
  };

  // Normalize data for consistent chart display
  const normalizeData = (data: TrendDataPoint[]) => {
    if (data.length === 0) return [];

    // Calculate min and max values
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1; // Prevent division by zero

    // Normalize values to 0-100 scale
    return data.map(d => ({
      ...d,
      normalizedValue: ((d.value - min) / range) * 100
    }));
  };

  const normalizedData = normalizeData(data);

  return (
    <Card className="bg-[#22252D] border-[#30363D] rounded-2xl shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <div className="mr-2">
              {getMetricIcon()}
            </div>
            <h3 className="text-sm font-medium text-[#8B949E]">{title}</h3>
          </div>
          <span className={`text-xs font-medium ${
            trendDirection === 'up' ? 'text-[#00FFAA]' : 
            trendDirection === 'down' ? 'text-[#FF6B6B]' : 'text-[#A0A3A8]'
          }`}>
            {trendDirection === 'up' ? '↗' : trendDirection === 'down' ? '↘' : '→'} {changePercentage.toFixed(1)}%
          </span>
        </div>
        
        <p className="text-xl font-bold text-white mb-2">
          {typeof value === 'number' ? value.toLocaleString() : value}{unit && <span className="text-sm ml-1 text-[#A0A3A8]">{unit}</span>}
        </p>
        
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={normalizedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2D33" vertical={false} />
              <XAxis 
                dataKey="date" 
                hide={true}
              />
              <YAxis 
                hide={true}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#22252D',
                  borderColor: '#2A2D33',
                  color: '#E4E6EB',
                  borderRadius: '0.5rem'
                }}
                formatter={(value, name, props) => {
                  // Use the index from the payload to find the corresponding original value
                  // Note: Recharts payload may have different property names in newer versions
                  const payload = props as any; // Type assertion for compatibility
                  const originalValue = data[payload.dataIndex]?.value;
                  return [originalValue, title];
                }}
              />
              <Line
                type="monotone"
                dataKey="normalizedValue"
                stroke={getMetricColor()}
                strokeWidth={2}
                dot={false}
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrendCard;