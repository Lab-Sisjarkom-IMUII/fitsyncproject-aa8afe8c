import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface Props {
  data: any[];
  dataKey: string;
  nameKey?: string;
  color?: string;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

const InsightLineChart: React.FC<Props> = ({
  data = [],
  dataKey,
  nameKey = 'name',
  color = '#4FB3FF',
  title,
  className = '',
  children
}) => {
  // Safely handle empty or undefined data
  const hasValidData = data && Array.isArray(data) && data.length > 0 && data.some(item => item && item[dataKey] !== undefined && item[dataKey] !== null);
  const displayData = hasValidData ? data : Array(7).fill(0).map((_, i) => ({ [nameKey]: `Day ${i + 1}`, [dataKey]: 0 }));

  return (
    <div className={`bg-[#161B22] border-[#30363D] rounded-2xl shadow-md transition-all duration-200 ${className}`}>
      {title && (
        <div className="p-4 border-b border-[#30363D]">
          <h3 className="text-white font-medium">{title}</h3>
        </div>
      )}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={displayData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
            <XAxis
              dataKey={nameKey}
              stroke="#8B949E"
              tick={{ fill: '#8B949E' }}
            />
            <YAxis
              stroke="#8B949E"
              tick={{ fill: '#8B949E' }}
              yAxisId="left"
            />
            <YAxis
              stroke="#4FB3FF"
              tick={{ fill: '#4FB3FF' }}
              orientation="right"
              yAxisId="right"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#22252D',
                borderColor: '#30363D',
                color: '#E4E6EB',
                borderRadius: '0.5rem'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              yAxisId="left"
              activeDot={{ r: 8 }}
              isAnimationActive={false} // Disable animation for empty data
            />
            {children}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default InsightLineChart;