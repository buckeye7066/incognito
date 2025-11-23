import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

export default function RiskBadge({ score, size = 'md' }) {
  const getRiskLevel = () => {
    if (score >= 70) return { label: 'Critical', color: 'red', icon: AlertTriangle };
    if (score >= 40) return { label: 'Medium', color: 'amber', icon: AlertCircle };
    return { label: 'Low', color: 'green', icon: CheckCircle };
  };

  const risk = getRiskLevel();
  const Icon = risk.icon;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const colorClasses = {
    red: 'bg-red-500/20 text-red-300 border-red-500/40',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    green: 'bg-green-500/20 text-green-300 border-green-500/40'
  };

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${sizeClasses[size]} ${colorClasses[risk.color]}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{risk.label}</span>
      <span className="opacity-75">({score})</span>
    </div>
  );
}