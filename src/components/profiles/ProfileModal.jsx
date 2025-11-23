import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';

const COLORS = [
  { value: 'purple', label: 'Purple', class: 'from-purple-600 to-indigo-600' },
  { value: 'blue', label: 'Blue', class: 'from-blue-600 to-cyan-600' },
  { value: 'green', label: 'Green', class: 'from-green-600 to-emerald-600' },
  { value: 'red', label: 'Red', class: 'from-red-600 to-pink-600' },
  { value: 'pink', label: 'Pink', class: 'from-pink-600 to-rose-600' },
  { value: 'amber', label: 'Amber', class: 'from-amber-600 to-orange-600' },
  { value: 'cyan', label: 'Cyan', class: 'from-cyan-600 to-teal-600' },
  { value: 'indigo', label: 'Indigo', class: 'from-indigo-600 to-purple-600' }
];

export default function ProfileModal({ open, onClose, onSave, editProfile }) {
  const [formData, setFormData] = useState(editProfile || {
    name: '',
    description: '',
    avatar_color: 'purple',
    is_default: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    setFormData({ name: '', description: '', avatar_color: 'purple', is_default: false });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-purple-500/50 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-purple-400" />
            </div>
            {editProfile ? 'Edit Profile' : 'Create New Profile'}
          </DialogTitle>
          <DialogDescription className="text-purple-300">
            {editProfile 
              ? 'Update the profile information'
              : 'Create a new monitoring profile to organize your data'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-purple-200">Profile Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Personal, Family Member, Business"
              className="bg-slate-900/50 border-purple-500/30 text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-purple-200">Description (Optional)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this profile..."
              className="bg-slate-900/50 border-purple-500/30 text-white h-20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-purple-200">Profile Color</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatar_color: color.value })}
                  className={`h-12 rounded-lg bg-gradient-to-br ${color.class} hover:scale-105 transition-transform ${
                    formData.avatar_color === color.value
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                      : ''
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-purple-500/50 text-purple-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              {editProfile ? 'Update Profile' : 'Create Profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}