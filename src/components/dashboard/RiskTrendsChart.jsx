import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

export default function RiskTrendsChart({ reports }) {
  if (!reports || reports.length === 0) {
    return null;
  }

  // Prepare data for chart
  const chartData = reports
    .sort((a, b) => new Date(a.report_date) - new Date(b.report_date))
    .map(report => ({
      date: new Date(report.report_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      risk: report.overall_risk_score || 0,
      fullDate: report.report_date
    }));

  // Calculate trend
  const latestScore = chartData[chartData.length - 1]?.risk || 0;
  const previousScore = chartData.length > 1 ? chartData[chartData.length - 2]?.risk : latestScore;
  const trendDiff = latestScore - previousScore;
  
  const getTrendIcon = () => {
    if (trendDiff < -5) return <TrendingDown className="w-5 h-5 text-green-400" />;
    if (trendDiff > 5) return <TrendingUp className="w-5 h-5 text-red-400" />;
    return <Minus className="w-5 h-5 text-purple-400" />;
  };

  const getTrendColor = () => {
    if (trendDiff < -5) return 'text-green-400';
    if (trendDiff > 5) return 'text-red-400';
    return 'text-purple-400';
  };

  const getTrendText = () => {
    if (trendDiff < -5) return 'Improving';
    if (trendDiff > 5) return 'Worsening';
    return 'Stable';
  };

  return (
    <Card className="glass-card border-purple-500/30">
      <CardHeader className="border-b border-purple-500/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Risk Score Trends</CardTitle>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className={`text-sm font-semibold ${getTrendColor()}`}>
              {getTrendText()} ({trendDiff > 0 ? '+' : ''}{trendDiff.toFixed(0)})
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#6b21a8" opacity={0.2} />
              <XAxis 
                dataKey="date" 
                stroke="#a78bfa" 
                tick={{ fill: '#c4b5fd' }}
                tickLine={{ stroke: '#6b21a8' }}
              />
              <YAxis 
                stroke="#a78bfa" 
                tick={{ fill: '#c4b5fd' }}
                tickLine={{ stroke: '#6b21a8' }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e1b4b', 
                  border: '1px solid #6b21a8',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                labelStyle={{ color: '#c4b5fd' }}
              />
              <Area
                type="monotone"
                dataKey="risk"
                stroke="#a855f7"
                strokeWidth={3}
                fill="url(#riskGradient)"
                name="Risk Score"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-purple-500/20">
          <div className="text-center">
            <p className="text-xs text-purple-400 mb-1">Current</p>
            <p className="text-2xl font-bold text-white">{latestScore}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-purple-400 mb-1">Average</p>
            <p className="text-2xl font-bold text-white">
              {Math.round(chartData.reduce((sum, d) => sum + d.risk, 0) / chartData.length)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-purple-400 mb-1">Peak</p>
            <p className="text-2xl font-bold text-white">
              {Math.max(...chartData.map(d => d.risk))}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}