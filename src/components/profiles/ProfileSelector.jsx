import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Plus, User } from 'lucide-react';

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

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {/* Active profile button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorClasses[activeProfile?.avatar_color || 'purple']} flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0`}>
          {activeProfile ? getInitials(activeProfile.name) : <User className="w-5 h-5" />}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {activeProfile?.name || 'Select Profile'}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {activeProfile?.description || 'Click to switch profile'}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-red-600/30 rounded-xl shadow-2xl overflow-hidden z-50">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => { setOpen(false); onProfileChange(profile); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                activeProfile?.id === profile.id
                  ? 'bg-red-600/20 text-white'
                  : 'text-gray-200 hover:bg-white/5'
              }`}
            >
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colorClasses[profile.avatar_color || 'purple']} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                {getInitials(profile.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{profile.name}</p>
                {profile.description && (
                  <p className="text-xs text-gray-400 truncate">{profile.description}</p>
                )}
              </div>
              {activeProfile?.id === profile.id && (
                <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              )}
            </button>
          ))}
          <div className="border-t border-red-600/20" />
          <button
            onClick={() => { setOpen(false); onCreateNew(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Create New Profile</span>
          </button>
        </div>
      )}
    </div>
  );
}