import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ title, value, icon: Icon, trend, color = 'purple' }) {
  const colorClasses = {
    purple: 'from-purple-600 to-indigo-600',
    red: 'from-red-600 to-pink-600',
    amber: 'from-amber-600 to-orange-600',
    green: 'from-green-600 to-emerald-600',
    blue: 'from-blue-600 to-cyan-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-6 hover:glow-border transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-purple-300 mb-2">{title}</p>
          <p className="text-3xl font-bold text-white mb-1">{value}</p>
          {trend && (
            <p className="text-xs text-purple-400">{trend}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );
}