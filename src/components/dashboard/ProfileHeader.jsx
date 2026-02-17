import React from 'react';
import { User, Mail } from 'lucide-react';

export default function ProfileHeader({ user }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 bg-gradient-to-br from-slate-800 to-slate-600 rounded-full flex items-center justify-center">
          <span className="text-2xl font-semibold text-white">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
          </span>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome back, {user?.full_name || 'Customer'}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-slate-500">
            <Mail className="h-4 w-4" />
            <span className="text-sm">{user?.email || ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}