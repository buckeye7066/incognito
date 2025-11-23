import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Plus, User } from 'lucide-react';
import { motion } from 'framer-motion';

const colorClasses = {
  purple: 'from-purple-600 to-indigo-600',
  blue: 'from-blue-600 to-cyan-600',
  green: 'from-green-600 to-emerald-600',
  red: 'from-red-600 to-pink-600',
  pink: 'from-pink-600 to-rose-600',
  amber: 'from-amber-600 to-orange-600',
  cyan: 'from-cyan-600 to-teal-600',
  indigo: 'from-indigo-600 to-purple-600'
};

export default function ProfileSelector({ activeProfile, onProfileChange, onCreateNew }) {
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.Profile.list()
  });

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-4 py-6 hover:bg-purple-500/10"
        >
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorClasses[activeProfile?.avatar_color || 'purple']} flex items-center justify-center text-white font-bold shadow-lg`}>
            {activeProfile ? getInitials(activeProfile.name) : <User className="w-5 h-5" />}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {activeProfile?.name || 'Select Profile'}
            </p>
            <p className="text-xs text-purple-300 truncate">
              {activeProfile?.description || 'No profile selected'}
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-purple-400 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 bg-slate-900 border-purple-500/30">
        {profiles.map((profile) => (
          <DropdownMenuItem
            key={profile.id}
            onClick={() => onProfileChange(profile)}
            className={`cursor-pointer p-3 ${
              activeProfile?.id === profile.id
                ? 'bg-purple-500/20 text-white'
                : 'text-purple-200 hover:bg-purple-500/10'
            }`}
          >
            <div className="flex items-center gap-3 w-full">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colorClasses[profile.avatar_color]} flex items-center justify-center text-white font-bold text-sm`}>
                {getInitials(profile.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{profile.name}</p>
                {profile.description && (
                  <p className="text-xs text-purple-400 truncate">{profile.description}</p>
                )}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-purple-500/30" />
        <DropdownMenuItem
          onClick={onCreateNew}
          className="cursor-pointer p-3 text-purple-300 hover:bg-purple-500/10"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Profile
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}