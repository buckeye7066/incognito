import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bell, AlertTriangle, CheckCircle, Trash2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const severityColors = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  low: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
};

const alertTypeLabels = {
  exposure_forewarning: 'Exposure Forewarning',
  new_breach_detected: 'New Breach Detected',
  high_risk_alert: 'High Risk Alert',
  emerging_threat: 'Emerging Threat',
  mitigation_reminder: 'Mitigation Reminder'
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: allNotifications = [] } = useQuery({
    queryKey: ['notificationAlerts'],
    queryFn: () => base44.entities.NotificationAlert.list()
  });

  const notifications = allNotifications
    .filter(n => !activeProfileId || n.profile_id === activeProfileId)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NotificationAlert.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notificationAlerts']);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.NotificationAlert.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notificationAlerts']);
    }
  });

  const markAsRead = (id) => {
    updateMutation.mutate({ id, data: { is_read: true } });
  };

  const markAllAsRead = () => {
    const unread = notifications.filter(n => !n.is_read);
    unread.forEach(n => markAsRead(n.id));
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.is_read;
    if (filter === 'critical') return n.severity === 'critical';
    return n.alert_type === filter;
  });

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Bell className="w-10 h-10 text-purple-400" />
            Notifications
          </h1>
          <p className="text-purple-300">Proactive alerts and exposure forewarnings</p>
        </div>
        <Button
          onClick={markAllAsRead}
          variant="outline"
          disabled={notifications.filter(n => !n.is_read).length === 0}
          className="border-purple-500/50 text-purple-300"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Mark All Read
        </Button>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-slate-900/50">
          <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread">
            Unread ({notifications.filter(n => !n.is_read).length})
          </TabsTrigger>
          <TabsTrigger value="critical">
            Critical ({notifications.filter(n => n.severity === 'critical').length})
          </TabsTrigger>
          <TabsTrigger value="exposure_forewarning">Forewarnings</TabsTrigger>
          <TabsTrigger value="new_breach_detected">New Breaches</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notifications List */}
      <AnimatePresence mode="popLayout">
        {filteredNotifications.length > 0 ? (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <Card className={`glass-card border-purple-500/20 hover:glow-border transition-all duration-300 ${!notification.is_read ? 'border-l-4 border-l-purple-500' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-bold text-white">{notification.title}</h3>
                              {!notification.is_read && (
                                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                              )}
                            </div>
                            <p className="text-xs text-purple-400">
                              {alertTypeLabels[notification.alert_type]}
                            </p>
                          </div>
                          <Badge className={`${severityColors[notification.severity]} border flex-shrink-0`}>
                            {notification.severity}
                          </Badge>
                        </div>

                        <p className="text-purple-300 text-sm mb-3">
                          {notification.message}
                        </p>

                        {notification.confidence_score && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-purple-400 mb-1">
                              <span>AI Confidence</span>
                              <span>{notification.confidence_score}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full"
                                style={{ width: `${notification.confidence_score}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {notification.threat_indicators && notification.threat_indicators.length > 0 && (
                          <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                            <p className="text-xs font-semibold text-red-300 mb-2">Threat Indicators:</p>
                            <ul className="space-y-1">
                              {notification.threat_indicators.map((indicator, idx) => (
                                <li key={idx} className="text-xs text-red-200 flex items-start gap-2">
                                  <span className="text-red-400 flex-shrink-0">•</span>
                                  <span>{indicator}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-3 border-t border-purple-500/20">
                          {!notification.is_read && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                              className="border-purple-500/50 text-purple-300"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Mark Read
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMutation.mutate(notification.id)}
                            className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                          <span className="ml-auto text-xs text-purple-400">
                            {new Date(notification.created_date).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="glass-card border-purple-500/20">
            <CardContent className="p-16 text-center">
              <Bell className="w-16 h-16 text-purple-500 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold text-white mb-2">No Notifications</h3>
              <p className="text-purple-300">
                {filter === 'all' 
                  ? 'You have no notifications yet' 
                  : `No notifications match this filter`}
              </p>
            </CardContent>
          </Card>
        )}
      </AnimatePresence>
    </div>
  );
}