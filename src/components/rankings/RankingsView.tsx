'use client';

import React, { useState } from 'react';
import {
  Trophy,
  Medal,
  ArrowUpDown,
  Users,
  Flame,
  Award,
  Star,
} from 'lucide-react';
import { Player, Session, SessionParticipant } from '@/types';
import { parseSkillLevelNumber } from '@/lib/rating/ratingEngine';

interface RankingsViewProps {
  players: Player[];
  sessions: Session[];
  participants: SessionParticipant[];
  activeSession?: Session;
}

type SortField = 'wins' | 'winPct' | 'gamesPlayed' | 'pointDiff' | 'rating';

export function RankingsView({
  players,
  sessions,
  participants,
  activeSession,
}: RankingsViewProps) {
  const [viewMode, setViewMode] = useState<'all-time' | 'session'>('session');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    activeSession ? activeSession.id : sessions[0]?.id || ''
  );
  const [sortField, setSortField] = useState<SortField>('wins');
  const [sortAsc, setSortAsc] = useState(false);

  // Player map for photos, skill levels & ratings
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Filter participants for selected session
  const sessionParticipants = participants.filter(
    (p) => p.sessionId === selectedSessionId
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending
    }
  };

  // Prepare table data
  let rows: Array<{
    id: string;
    name: string;
    photoUrl?: string;
    skillLevel: string;
    rating: number;
    avatarColor?: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    winPct: number;
    scored: number;
    conceded: number;
    pointDiff: number;
  }> = [];

  if (viewMode === 'all-time') {
    const active = players.filter((p) => !p.isArchived);
    rows = active.map((p) => {
      const gp = p.stats.gamesPlayed || 0;
      const wins = p.stats.wins || 0;
      const losses = p.stats.losses || 0;
      const scored = p.stats.pointsScored || 0;
      const conceded = p.stats.pointsConceded || 0;
      const winPct = gp > 0 ? (wins / gp) * 100 : 0;
      const currentRating = p.rating ?? parseSkillLevelNumber(p.skillLevel);

      return {
        id: p.id,
        name: p.name,
        photoUrl: p.photoUrl,
        skillLevel: p.skillLevel || '3.0',
        rating: currentRating,
        avatarColor: p.avatarColor,
        gamesPlayed: gp,
        wins,
        losses,
        winPct,
        scored,
        conceded,
        pointDiff: scored - conceded,
      };
    });
  } else {
    rows = sessionParticipants.map((p) => {
      const registered = playerMap.get(p.playerId);
      const gp = p.gamesPlayed || 0;
      const wins = p.wins || 0;
      const losses = p.losses || 0;
      const scored = p.pointsScored || 0;
      const conceded = p.pointsConceded || 0;
      const winPct = gp > 0 ? (wins / gp) * 100 : 0;
      const currentRating = registered?.rating ?? parseSkillLevelNumber(registered?.skillLevel);

      return {
        id: p.id,
        name: p.playerName,
        photoUrl: registered?.photoUrl,
        skillLevel: registered?.skillLevel || '3.0',
        rating: currentRating,
        avatarColor: registered?.avatarColor,
        gamesPlayed: gp,
        wins,
        losses,
        winPct,
        scored,
        conceded,
        pointDiff: scored - conceded,
      };
    });
  }

  // Sort rows
  rows.sort((a, b) => {
    let diff = 0;
    if (sortField === 'wins') {
      diff = a.wins - b.wins;
      if (diff === 0) diff = a.pointDiff - b.pointDiff;
    } else if (sortField === 'rating') {
      diff = a.rating - b.rating;
      if (diff === 0) diff = a.wins - b.wins;
    } else if (sortField === 'winPct') {
      diff = a.winPct - b.winPct;
      if (diff === 0) diff = a.gamesPlayed - b.gamesPlayed;
    } else if (sortField === 'gamesPlayed') {
      diff = a.gamesPlayed - b.gamesPlayed;
      if (diff === 0) diff = a.wins - b.wins;
    } else if (sortField === 'pointDiff') {
      diff = a.pointDiff - b.pointDiff;
      if (diff === 0) diff = a.wins - b.wins;
    }
    return sortAsc ? diff : -diff;
  });

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-court-lightBorder dark:border-court-darkBorder pb-4">
        <div>
          <h2 className="text-2xl font-black text-court-darkBg dark:text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Rankings & Leaderboard
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Open play standings based on match wins, dynamic performance ratings (Est. DUPR), and point differentials.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center p-1 rounded-xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder self-start sm:self-auto shadow-sm">
          <button
            onClick={() => setViewMode('session')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'session'
                ? 'bg-pickle-400 text-court-darkBg shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-court-darkBg dark:hover:text-white'
            }`}
          >
            Session Leaderboard
          </button>
          <button
            onClick={() => setViewMode('all-time')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'all-time'
                ? 'bg-pickle-400 text-court-darkBg shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-court-darkBg dark:hover:text-white'
            }`}
          >
            All-Time Rankings
          </button>
        </div>
      </div>

      {/* Session Selector (when in Session Leaderboard mode) */}
      {viewMode === 'session' && (
        <div className="p-4 rounded-xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-court-darkBg dark:text-white">
            Select Open Play Session:
          </span>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs font-bold text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.date}) — {s.status.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Top 3 Podium Cards */}
      {rows.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {/* 2nd Place */}
          <div className="p-4 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder flex flex-col items-center justify-between text-center mt-4 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white font-black text-xs flex items-center justify-center">
              2
            </div>
            <div className="my-2 flex flex-col items-center">
              {rows[1].photoUrl ? (
                <img src={rows[1].photoUrl} alt="" className="w-10 h-10 rounded-full object-cover mb-1 ring-1 ring-slate-400" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white mb-1" style={{ backgroundColor: rows[1].avatarColor || '#059669' }}>
                  {rows[1].name[0]}
                </div>
              )}
              <h4 className="font-bold text-sm text-court-darkBg dark:text-white truncate max-w-[120px]">
                {rows[1].name}
              </h4>
              <p className="text-xs font-extrabold text-emerald-500">{rows[1].wins} Wins</p>
              <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-amber-400" /> {rows[1].rating.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] text-gray-400">{rows[1].winPct.toFixed(0)}% Win Rate</span>
          </div>

          {/* 1st Place */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-500/20 to-court-lightCard dark:to-court-darkCard border border-amber-500/40 flex flex-col items-center justify-between text-center shadow-md relative">
            <div className="w-10 h-10 rounded-full bg-amber-400 text-court-darkBg font-black text-sm flex items-center justify-center shadow-lg -mt-2">
              <Medal className="w-5 h-5 fill-court-darkBg" />
            </div>
            <div className="my-2 flex flex-col items-center">
              {rows[0].photoUrl ? (
                <img src={rows[0].photoUrl} alt="" className="w-12 h-12 rounded-full object-cover mb-1 ring-2 ring-amber-400 shadow-md" />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-sm text-white mb-1 shadow-md" style={{ backgroundColor: rows[0].avatarColor || '#059669' }}>
                  {rows[0].name[0]}
                </div>
              )}
              <h4 className="font-black text-base text-court-darkBg dark:text-white truncate max-w-[140px]">
                {rows[0].name}
              </h4>
              <p className="text-sm font-black text-amber-500">{rows[0].wins} Wins</p>
              <span className="text-[11px] font-extrabold text-amber-500 flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-amber-400" /> {rows[0].rating.toFixed(2)} DUPR
              </span>
            </div>
            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">
              {rows[0].winPct.toFixed(0)}% Win Rate
            </span>
          </div>

          {/* 3rd Place */}
          <div className="p-4 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder flex flex-col items-center justify-between text-center mt-6 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-amber-700/30 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center">
              3
            </div>
            <div className="my-2 flex flex-col items-center">
              {rows[2].photoUrl ? (
                <img src={rows[2].photoUrl} alt="" className="w-10 h-10 rounded-full object-cover mb-1 ring-1 ring-amber-700" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white mb-1" style={{ backgroundColor: rows[2].avatarColor || '#059669' }}>
                  {rows[2].name[0]}
                </div>
              )}
              <h4 className="font-bold text-sm text-court-darkBg dark:text-white truncate max-w-[120px]">
                {rows[2].name}
              </h4>
              <p className="text-xs font-extrabold text-emerald-500">{rows[2].wins} Wins</p>
              <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-amber-400" /> {rows[2].rating.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] text-gray-400">{rows[2].winPct.toFixed(0)}% Win Rate</span>
          </div>
        </div>
      )}

      {/* Standings Table */}
      <div className="rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-court-lightBg/80 dark:bg-court-darkBg/80 text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider border-b border-court-lightBorder dark:border-court-darkBorder">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-3">Level</th>
                <th
                  onClick={() => handleSort('rating')}
                  className="py-3 px-4 cursor-pointer hover:text-court-darkBg dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1 text-amber-500">
                    <span>Rating (Est. DUPR)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('gamesPlayed')}
                  className="py-3 px-4 cursor-pointer hover:text-court-darkBg dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Games</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('wins')}
                  className="py-3 px-4 cursor-pointer hover:text-court-darkBg dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Wins</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Losses</th>
                <th
                  onClick={() => handleSort('winPct')}
                  className="py-3 px-4 cursor-pointer hover:text-court-darkBg dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Win %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pointDiff')}
                  className="py-3 px-4 cursor-pointer hover:text-court-darkBg dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Pt Diff</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-court-lightBorder/50 dark:divide-court-darkBorder/50 text-court-darkBg dark:text-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    No matches or rankings data available for this selection.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="hover:bg-court-lightBg/50 dark:hover:bg-court-darkCardHover/50 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-black text-gray-400">
                      {idx === 0 ? (
                        <span className="w-5 h-5 rounded-full bg-amber-400 text-court-darkBg font-black inline-flex items-center justify-center text-[10px]">
                          1
                        </span>
                      ) : idx === 1 ? (
                        <span className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-700 text-court-darkBg dark:text-white font-black inline-flex items-center justify-center text-[10px]">
                          2
                        </span>
                      ) : idx === 2 ? (
                        <span className="w-5 h-5 rounded-full bg-amber-700/30 text-amber-600 dark:text-amber-400 font-black inline-flex items-center justify-center text-[10px]">
                          3
                        </span>
                      ) : (
                        `#${idx + 1}`
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold truncate max-w-[180px]">
                      <div className="flex items-center gap-2">
                        {row.photoUrl ? (
                          <img src={row.photoUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-pickle-400" />
                        ) : (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: row.avatarColor || '#059669' }}>
                            {row.name[0]}
                          </div>
                        )}
                        <span className="truncate">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-pickle-400/20 text-pickle-700 dark:text-pickle-300 border border-pickle-400/30">
                        {row.skillLevel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-amber-500 font-mono text-sm">
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {row.rating.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-500 dark:text-gray-400">
                      {row.gamesPlayed}
                    </td>
                    <td className="py-3.5 px-4 font-black text-emerald-500">{row.wins}</td>
                    <td className="py-3.5 px-4 font-medium text-red-400">{row.losses}</td>
                    <td className="py-3.5 px-4 font-black text-pickle-600 dark:text-pickle-400">
                      {row.winPct.toFixed(0)}%
                    </td>
                    <td
                      className={`py-3.5 px-4 font-mono font-black ${
                        row.pointDiff >= 0 ? 'text-pickle-500' : 'text-red-400'
                      }`}
                    >
                      {row.pointDiff >= 0 ? `+${row.pointDiff}` : row.pointDiff}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
