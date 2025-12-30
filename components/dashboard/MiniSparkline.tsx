'use client';

import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface MiniSparklineProps {
  data: { date: string; value: number }[];
  color?: string;
  height?: number;
}

const MiniSparkline = ({ data = [], color = '#00FFAA', height = 60 }: MiniSparklineProps) => {
  // Handle empty data case
  if (!data || data.length === 0) {
    // Create dummy data for empty state
    const emptyData = Array(7).fill(0).map((_, i) => ({
      date: `Day ${i + 1}`,
      value: 0
    }));

    return (
      <div className="w-full h-full">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={emptyData}>
            <defs>
              <linearGradient id={`colorGradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              hide={true}
            />
            <YAxis
              domain={[0, 100]}
              hide={true}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#colorGradient-${color})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Calculate min and max values for normalization
  const values = data.map(item => item.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1; // Avoid division by zero

  // Normalize values to fit within the sparkline
  const normalizedData = data.map(item => ({
    ...item,
    normalizedValue: ((item.value - minValue) / range) * 100 // Scale to 0-100
  }));

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={normalizedData}>
          <defs>
            <linearGradient id={`colorGradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            hide={true}
          />
          <YAxis 
            domain={[0, 100]} 
            hide={true}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#22252D', 
              borderColor: '#2A2D33', 
              color: '#E4E6EB',
              borderRadius: '0.5rem',
              fontSize: '0.75rem'
            }}
            formatter={(value, name) => [data.find(d => d.date === normalizedData.find(nd => nd.normalizedValue === value)?.date)?.value, 'Value']}
            labelFormatter={() => ''}
          />
          <Area
            type="monotone"
            dataKey="normalizedValue"
            stroke={color}
            fill={`url(#colorGradient-${color})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MiniSparkline;