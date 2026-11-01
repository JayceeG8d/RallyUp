'use client';

import React, { useState } from 'react';
import {
  History,
  Calendar,
  MapPin,
  Search,
  ChevronRight,
  Trophy,
  Users,
  X,
  Trash2,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { Session, Match, SessionParticipant } from '@/types';
import { SessionRepo } from '@/lib/db/repository';

interface GameHistoryViewProps {
  sessions: Session[];
  matches: Match[];
  participants: SessionParticipant[];
  onSessionDeleted: () => void;
}

export function GameHistoryView({
  sessions,
  matches,
  participants,
  onSessionDeleted,
}: GameHistoryViewProps) {
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  const filteredSessions = sessions.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.location && s.location.toLowerCase().includes(search.toLowerCase())) ||
      s.date.includes(search)
  );

  const selectedMatches = selectedSession
    ? matches.filter((m) => m.sessionId === selectedSession.id)
    : [];

  const selectedParticipants = selectedSession
    ? participants.filter((p) => p.sessionId === selectedSession.id)
    : [];

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      await SessionRepo.deleteSession(sessionToDelete.id);
      setSessionToDelete(null);
      if (selectedSession?.id === sessionToDelete.id) {
        setSelectedSession(null);
      }
      onSessionDeleted();
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-court-lightBorder dark:border-court-darkBorder pb-4">
        <div>
          <h2 className="text-2xl font-black text-court-darkBg dark:text-white flex items-center gap-2">
            <History className="w-6 h-6 text-sky-500" />
            Game History ({sessions.length})
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Browse past open plays, match scores, and participant performance.
          </p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by session name, facility location, or date..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder text-sm text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400 shadow-sm"
        />
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-court-lightBorder dark:border-court-darkBorder p-8 space-y-2">
          <History className="w-10 h-10 text-gray-400 mx-auto" />
          <h4 className="font-bold text-base text-court-darkBg dark:text-white">
            No sessions found
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {search
              ? 'No historical sessions match your search criteria.'
              : 'Complete an open play session to view its match history here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const sessMatches = matches.filter((m) => m.sessionId === session.id);
            const completed = sessMatches.filter((m) => m.status === 'completed');
            const sessParts = participants.filter((p) => p.sessionId === session.id);

            return (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder hover:border-pickle-400/50 shadow-sm cursor-pointer transition-all hover:scale-[1.005] flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        session.status === 'active'
                          ? 'bg-pickle-400/20 text-pickle-700 dark:text-pickle-300 border border-pickle-400/30'
                          : 'bg-gray-500/20 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {session.status}
                    </span>
                    <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {session.date} • {session.startTime}
                    </span>
                  </div>

                  <h3 className="font-black text-lg text-court-darkBg dark:text-white group-hover:text-pickle-600 dark:group-hover:text-pickle-400 transition-colors">
                    {session.name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-0.5">
                    {session.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {session.location}
                      </span>
                    )}
                    <span>{session.numCourts} courts</span>
                    <span>•</span>
                    <span>{sessParts.length} players</span>
                    <span>•</span>
                    <span>{completed.length} matches completed</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSessionToDelete(session);
                    }}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg text-court-darkBg dark:text-white font-bold text-xs group-hover:bg-pickle-400 group-hover:text-court-darkBg transition-colors">
                    <span>View Matches</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder p-6 space-y-5 shadow-2xl text-court-darkBg dark:text-white flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-court-lightBorder dark:border-court-darkBorder pb-3 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase text-pickle-500 tracking-wider">
                  Session Summary
                </span>
                <h3 className="font-black text-xl text-court-darkBg dark:text-white">
                  {selectedSession.name}
                </h3>
                <p className="text-xs text-gray-400">
                  {selectedSession.date} • {selectedSession.numCourts} Courts •{' '}
                  {selectedSession.matchFormat.toUpperCase()} ({selectedSession.scoringFormat})
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stats Strip */}
            <div className="grid grid-cols-3 gap-3 shrink-0 text-center text-xs">
              <div className="p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder">
                <span className="text-gray-400 block font-bold text-[10px] uppercase">
                  Players
                </span>
                <span className="font-black text-lg text-court-darkBg dark:text-white">
                  {selectedParticipants.length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder">
                <span className="text-gray-400 block font-bold text-[10px] uppercase">
                  Completed Matches
                </span>
                <span className="font-black text-lg text-court-darkBg dark:text-white">
                  {selectedMatches.filter((m) => m.status === 'completed').length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder">
                <span className="text-gray-400 block font-bold text-[10px] uppercase">
                  Rounds Run
                </span>
                <span className="font-black text-lg text-pickle-500">
                  {selectedSession.currentRound}
                </span>
              </div>
            </div>

            {/* Matches List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-court-darkBg dark:text-white">
                Match Results ({selectedMatches.length})
              </h4>
              {selectedMatches.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">
                  No matches were recorded during this session.
                </p>
              ) : (
                selectedMatches.map((m) => {
                  const winnerA = m.winningTeam === 'teamA';
                  const winnerB = m.winningTeam === 'teamB';

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-400">
                            Court {m.courtNumber} • Round {m.roundNumber}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 uppercase font-semibold">
                            {m.scoringMethod}
                          </span>
                          {m.overrideReason && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                              Override: {m.overrideReason}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold space-y-0.5">
                          <p className={winnerA ? 'text-emerald-500 font-black' : 'text-court-darkBg dark:text-white'}>
                            Team A: {m.teamA.playerNames.join(' & ')} {winnerA && '🏆'}
                          </p>
                          <p className={winnerB ? 'text-emerald-500 font-black' : 'text-court-darkBg dark:text-white'}>
                            Team B: {m.teamB.playerNames.join(' & ')} {winnerB && '🏆'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right sm:text-right shrink-0">
                        <div className="text-xl font-mono font-black text-court-darkBg dark:text-white">
                          {m.scoreA} — {m.scoreB}
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">
                          Target {m.targetScore}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-court-lightBorder dark:border-court-darkBorder flex justify-end shrink-0">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-court-darkBg dark:text-white"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder p-6 space-y-4 shadow-2xl text-court-darkBg dark:text-white">
            <h4 className="font-black text-lg text-court-darkBg dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete Session?
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Are you sure you want to permanently delete <strong>{sessionToDelete.name}</strong> and its match records? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSession}
                className="px-4 py-2 rounded-xl text-xs font-black bg-red-500 hover:bg-red-600 text-white shadow-md"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
