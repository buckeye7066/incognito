import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const severityColors = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-blue-400'
};

export default function NotificationBell({ activeProfileId }) {
  const { data: allNotifications = [] } = useQuery({
    queryKey: ['notificationAlerts'],
    queryFn: () => base44.entities.NotificationAlert.list(),
    refetchInterval: 60000 // Refetch every minute
  });

  const notifications = allNotifications
    .filter(n => !activeProfileId || n.profile_id === activeProfileId)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const recentNotifications = notifications.slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-purple-300 hover:text-white hover:bg-purple-500/10"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs border-0">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 bg-slate-900 border-purple-500/30 max-h-96 overflow-y-auto">
        <div className="p-3 border-b border-purple-500/20">
          <h3 className="font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <p className="text-xs text-purple-400">{unreadCount} unread alerts</p>
          )}
        </div>

        {recentNotifications.length > 0 ? (
          <>
            {recentNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`p-3 cursor-pointer ${
                  !notification.is_read ? 'bg-purple-500/10' : ''
                }`}
                onClick={() => {
                  if (!notification.is_read) {
                    base44.entities.NotificationAlert.update(notification.id, { is_read: true });
                  }
                }}
              >
                <div className="flex gap-3 w-full">
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${severityColors[notification.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {notification.title}
                    </p>
                    <p className="text-xs text-purple-300 line-clamp-2 mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-purple-400 mt-1">
                      {new Date(notification.created_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-purple-500/30" />
            <DropdownMenuItem asChild>
              <Link
                to={createPageUrl('Notifications')}
                className="p-3 text-center text-purple-300 hover:text-white cursor-pointer"
              >
                View All Notifications
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-purple-500 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-purple-400">No notifications</p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}