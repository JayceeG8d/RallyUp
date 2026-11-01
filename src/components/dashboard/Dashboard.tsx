'use client';

import React from 'react';
import {
  Play,
  Users,
  Trophy,
  History,
  Settings,
  ShieldAlert,
  ArrowRight,
  Activity,
  Flame,
} from 'lucide-react';
import { Session, Player, Match } from '@/types';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  players: Player[];
  sessions: Session[];
  matches: Match[];
  activeSession?: Session;
}

export function Dashboard({
  onNavigate,
  players,
  sessions,
  matches,
  activeSession,
}: DashboardProps) {
  const activePlayers = players.filter((p) => !p.isArchived);
  const completedMatches = matches.filter((m) => m.status === 'completed');
  const recentSession = sessions[0];

  return (
    <div className="space-y-6 pb-20">
      {/* Active Session Banner (if session in progress) */}
      {activeSession ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pickle-600 via-pickle-500 to-pickle-400 p-6 text-court-darkBg shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-court-darkBg/20 text-court-darkBg font-bold text-xs uppercase tracking-wider backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-court-darkBg animate-pulse" />
                Session in Progress
              </div>
              <h2 className="text-2xl font-black tracking-tight">{activeSession.name}</h2>
              <p className="text-xs font-medium text-court-darkBg/80">
                Round {activeSession.currentRound} • {activeSession.numCourts} Courts •{' '}
                {activeSession.matchFormat.toUpperCase()} ({activeSession.scoringFormat})
              </p>
            </div>
            <button
              onClick={() => onNavigate('live-session')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-court-darkBg text-pickle-400 font-extrabold text-sm shadow-md hover:bg-court-darkCardHover transition-all transform active:scale-95"
            >
              Resume Live Session
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Hero Action Banner */
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-court-darkCard via-court-darkHeader to-court-darkBg p-6 sm:p-8 text-white border border-court-darkBorder shadow-lg">
          <div className="relative z-10 max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pickle-400/20 text-pickle-400 text-xs font-bold border border-pickle-400/30">
              <Flame className="w-3.5 h-3.5 text-pickle-400" />
              Ready for Open Play
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Organize, Rotate & Score <br />
              <span className="text-pickle-400">Like a Pro.</span>
            </h1>
            <p className="text-sm text-gray-300 font-medium leading-relaxed">
              Automated fair court rotations, split-color live scoreboard, side-out & rally scoring,
              and offline-first persistence.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate('new-session')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-pickle-400 hover:bg-pickle-300 text-court-darkBg font-black text-sm tracking-wide shadow-md transition-all transform active:scale-95"
              >
                <Play className="w-4 h-4 fill-court-darkBg" />
                Start New Open Play
              </button>
              <button
                onClick={() => onNavigate('players')}
                className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm border border-white/20 transition-all"
              >
                <Users className="w-4 h-4" />
                Manage Players
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Players</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-court-darkBg dark:text-white mt-1">
            {activePlayers.length}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Saved in roster</p>
        </div>

        <div className="p-4 rounded-xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Sessions</span>
            <Activity className="w-4 h-4 text-pickle-500" />
          </div>
          <p className="text-2xl font-black text-court-darkBg dark:text-white mt-1">
            {sessions.length}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Total sessions run</p>
        </div>

        <div className="p-4 rounded-xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Matches</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-court-darkBg dark:text-white mt-1">
            {completedMatches.length}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Completed matches</p>
        </div>

        <div className="p-4 rounded-xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Recent</span>
            <History className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-sm font-bold text-court-darkBg dark:text-white mt-1 truncate">
            {recentSession ? recentSession.name : 'None yet'}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {recentSession ? recentSession.date : 'Start a session'}
          </p>
        </div>
      </div>

      {/* Main Feature Navigation Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-court-darkBg dark:text-white uppercase tracking-wider px-1">
          Quick Access
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            onClick={() => onNavigate('new-session')}
            className="flex items-start gap-4 p-4 rounded-xl text-left bg-court-lightCard dark:bg-court-darkCard hover:bg-court-lightBg dark:hover:bg-court-darkCardHover border border-court-lightBorder dark:border-court-darkBorder transition-all group"
          >
            <div className="p-3 rounded-xl bg-pickle-400/20 text-pickle-600 dark:text-pickle-400 group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-court-darkBg dark:text-white">New Open Play</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Launch a session wizard with fair court rotation & scoring formats.
              </p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('players')}
            className="flex items-start gap-4 p-4 rounded-xl text-left bg-court-lightCard dark:bg-court-darkCard hover:bg-court-lightBg dark:hover:bg-court-darkCardHover border border-court-lightBorder dark:border-court-darkBorder transition-all group"
          >
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-court-darkBg dark:text-white">Saved Players</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Roster manager, player lifetime stats, win %, and match histories.
              </p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('rankings')}
            className="flex items-start gap-4 p-4 rounded-xl text-left bg-court-lightCard dark:bg-court-darkCard hover:bg-court-lightBg dark:hover:bg-court-darkCardHover border border-court-lightBorder dark:border-court-darkBorder transition-all group"
          >
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-court-darkBg dark:text-white">Leaderboard & Rankings</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Session rankings and lifetime stats sorted by wins, win %, and points.
              </p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('history')}
            className="flex items-start gap-4 p-4 rounded-xl text-left bg-court-lightCard dark:bg-court-darkCard hover:bg-court-lightBg dark:hover:bg-court-darkCardHover border border-court-lightBorder dark:border-court-darkBorder transition-all group"
          >
            <div className="p-3 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-court-darkBg dark:text-white">Game History</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Browse historical open plays, completed matches, and final scores.
              </p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className="flex items-start gap-4 p-4 rounded-xl text-left bg-court-lightCard dark:bg-court-darkCard hover:bg-court-lightBg dark:hover:bg-court-darkCardHover border border-court-lightBorder dark:border-court-darkBorder transition-all group"
          >
            <div className="p-3 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-court-darkBg dark:text-white">Data Backup & Export</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Versioned JSON backup, CSV exports, theme controls & offline management.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
