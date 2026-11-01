'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  hasActiveSession?: boolean;
}

export function Navbar({ currentTab, onNavigate, hasActiveSession }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-court-lightBorder dark:border-court-darkBorder bg-court-lightBg/95 dark:bg-court-darkHeader/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-3 text-left focus:outline-none group"
        >
          <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-md ring-1 ring-pickle-400/30 group-hover:scale-105 transition-transform">
            <Image
              src="/logo.png"
              alt="RallyUp Pickleball"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-court-darkBg dark:text-white">
                Rally<span className="text-pickle-600 dark:text-pickle-400">Up</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-pickle-400/20 text-pickle-700 dark:text-pickle-300 border border-pickle-400/30">
                MVP
              </span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wider uppercase -mt-0.5">
              Open Play Manager
            </p>
          </div>
        </button>

        {/* Action Controls & Toggles */}
        <div className="flex items-center gap-2">
          {/* Active Session Quick Pill */}
          {hasActiveSession && (
            <button
              onClick={() => onNavigate('live-session')}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-pickle-400 text-court-darkBg hover:bg-pickle-300 transition-colors shadow-sm animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-court-darkBg" />
              Active Session Live
            </button>
          )}

          {/* Online / Offline status badge */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
            title={isOnline ? 'Online mode' : 'Offline mode - All data saved in IndexedDB'}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-court-darkCardHover border border-court-lightBorder dark:border-court-darkBorder transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-pickle-400" />
            ) : (
              <Moon className="w-4 h-4 text-emerald-800" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
