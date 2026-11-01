'use client';

import React from 'react';
import {
  LayoutDashboard,
  PlayCircle,
  Users,
  Trophy,
  History,
  Settings,
} from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  hasActiveSession?: boolean;
}

export function BottomNav({ currentTab, onNavigate, hasActiveSession }: BottomNavProps) {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    {
      id: hasActiveSession ? 'live-session' : 'new-session',
      label: hasActiveSession ? 'Live Play' : 'New Play',
      icon: PlayCircle,
      highlight: hasActiveSession,
    },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'rankings', label: 'Rankings', icon: Trophy },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Backup', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-court-lightCard/95 dark:bg-court-darkCard/95 backdrop-blur-lg border-t border-court-lightBorder dark:border-court-darkBorder pb-[max(env(safe-area-inset-bottom),8px)] pt-2 px-2 transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
                isActive
                  ? 'text-pickle-600 dark:text-pickle-400 font-semibold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {tab.highlight && (
                <span className="absolute -top-1 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pickle-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-pickle-500"></span>
                </span>
              )}
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[11px] leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
