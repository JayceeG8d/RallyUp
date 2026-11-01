'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Play,
  RotateCw,
  Trophy,
  CheckCircle,
  Clock,
  Flame,
  ChevronRight,
  AlertCircle,
  PlusCircle,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import {
  Session,
  Court,
  Match,
  SessionParticipant,
} from '@/types';
import { db } from '@/lib/db/dexie';
import { SessionRepo, MatchRepo } from '@/lib/db/repository';
import { generateNextRoundMatches } from '@/lib/rotation/rotationEngine';
import { LiveScoreboard } from '@/components/scoreboard/LiveScoreboard';
import { ManualFinalScoreModal } from '@/components/live-session/ManualFinalScoreModal';

interface LiveSessionDashboardProps {
  session: Session;
  onSessionFinished: () => void;
  onExit: () => void;
}

export function LiveSessionDashboard({
  session,
  onSessionFinished,
  onExit,
}: LiveSessionDashboardProps) {
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  // Active modals
  const [activeLiveMatch, setActiveLiveMatch] = useState<Match | null>(null);
  const [activeManualMatch, setActiveManualMatch] = useState<Match | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [rotationMsg, setRotationMsg] = useState('');

  // Load session data
  const loadData = async () => {
    try {
      const c = await db.courts.where('sessionId').equals(session.id).toArray();
      const m = await db.matches.where('sessionId').equals(session.id).toArray();
      const p = await db.sessionParticipants
        .where('sessionId')
        .equals(session.id)
        .toArray();

      setCourts(c.sort((a, b) => a.courtNumber - b.courtNumber));
      setMatches(m);
      setParticipants(
        p.sort((a, b) => (a.currentQueueOrder || 0) - (b.currentQueueOrder || 0))
      );
      setLoading(false);
    } catch (err) {
      console.error('Error loading session data:', err);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh interval (every 3 seconds) to ensure reactive sync
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [session.id]);

  // Calculations
  const activeMatches = matches.filter((m) => m.status === 'in_progress');
  const completedMatches = matches.filter((m) => m.status === 'completed');
  const availableCourts = courts.filter((c) => c.status === 'available');
  const waitingParticipants = participants.filter((p) => p.status === 'waiting');

  // Match lookup by court
  const getCourtMatch = (courtNumber: number): Match | undefined => {
    return matches.find(
      (m) => m.courtNumber === courtNumber && m.status === 'in_progress'
    ) || matches
      .filter((m) => m.courtNumber === courtNumber && m.status === 'completed')
      .pop();
  };

  // Generate Next Round
  const handleGenerateNextRound = async () => {
    setRotationMsg('');
    if (availableCourts.length === 0) {
      setRotationMsg('All courts are currently busy with active matches.');
      return;
    }

    const playersPerCourt = session.matchFormat === 'doubles' ? 4 : 2;
    if (waitingParticipants.length < playersPerCourt) {
      setRotationMsg(
        `Not enough waiting players (${waitingParticipants.length}) to fill a court (needs ${playersPerCourt}).`
      );
      return;
    }

    const nextRound = (session.currentRound || 1) + 1;

    try {
      const { matches: newMatches, updatedParticipants } = generateNextRoundMatches({
        sessionId: session.id,
        roundNumber: nextRound,
        matchFormat: session.matchFormat,
        rotationMode: session.rotationMode,
        availableCourts,
        activeMatches,
        participants,
        completedMatches,
      });

      if (newMatches.length === 0) {
        setRotationMsg('No matches could be generated at this time.');
        return;
      }

      await db.transaction(
        'rw',
        [db.sessions, db.matches, db.courts, db.sessionParticipants],
        async () => {
          await db.sessions.update(session.id, { currentRound: nextRound });

          for (const m of newMatches) {
            await db.matches.add({
              ...m,
              scoringMethod: 'manual',
              scoringFormat: session.scoringFormat,
              targetScore: session.targetScore,
              winCondition: session.winCondition,
              scoreA: 0,
              scoreB: 0,
              status: 'in_progress',
              winningTeam: null,
              startedAt: Date.now(),
            });

            const court = courts.find((c) => c.courtNumber === m.courtNumber);
            if (court) {
              await db.courts.update(court.id, {
                status: 'playing',
                currentMatchId: m.id,
              });
            }
          }

          for (const p of updatedParticipants) {
            await db.sessionParticipants.update(p.id, {
              status: p.status,
            });
          }
        }
      );

      setRotationMsg(`Generated ${newMatches.length} match(es) for Round ${nextRound}!`);
      await loadData();
    } catch (err: any) {
      console.error('Error generating next round:', err);
      setRotationMsg(err.message || 'Error generating round.');
    }
  };

  const handleFinishSession = async () => {
    try {
      await SessionRepo.completeSession(session.id);
      onSessionFinished();
    } catch (err: any) {
      console.error('Failed to complete session:', err);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-gray-500">
        Loading session courts...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* Session Header Bar */}
      <div className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pickle-400 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-pickle-600 dark:text-pickle-400">
                Live Open Play
              </span>
              <span className="text-xs text-gray-400">• Round {session.currentRound}</span>
            </div>
            <h1 className="text-2xl font-black text-court-darkBg dark:text-white mt-1">
              {session.name}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {session.numCourts} Courts • {session.matchFormat.toUpperCase()} ({session.scoringFormat}) • Target {session.targetScore} ({session.winCondition.replace('_', ' ')}) • {session.rotationMode.toUpperCase()} rotation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleGenerateNextRound}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pickle-400 hover:bg-pickle-300 text-court-darkBg font-black text-xs tracking-wider uppercase transition-all shadow-md active:scale-95"
            >
              <RotateCw className="w-4 h-4" />
              <span>Next Round</span>
            </button>
            <button
              onClick={() => setShowFinishConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs border border-red-500/30 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Finish Session</span>
            </button>
          </div>
        </div>

        {rotationMsg && (
          <div className="p-3 rounded-xl bg-pickle-400/10 border border-pickle-400/30 text-xs font-bold text-pickle-800 dark:text-pickle-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{rotationMsg}</span>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-court-lightBorder dark:border-court-darkBorder text-xs">
          <div>
            <span className="text-gray-400">Active Matches:</span>{' '}
            <span className="font-bold text-court-darkBg dark:text-white">
              {activeMatches.length} / {courts.length}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Available Courts:</span>{' '}
            <span className="font-bold text-emerald-500">{availableCourts.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Waiting Queue:</span>{' '}
            <span className="font-bold text-amber-500">{waitingParticipants.length} players</span>
          </div>
          <div>
            <span className="text-gray-400">Completed Matches:</span>{' '}
            <span className="font-bold text-court-darkBg dark:text-white">
              {completedMatches.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Responsive Courts Grid (Left/Center) + Waiting Queue Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Courts Grid (takes 3 columns on large screens) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-court-darkBg dark:text-white">
              Courts ({courts.length})
            </h3>
            <span className="text-xs text-gray-400">
              Select Live Scoring or Enter Final Score per court
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courts.map((court) => {
              const currentMatch = getCourtMatch(court.courtNumber);
              const isPlaying = currentMatch && currentMatch.status === 'in_progress';
              const isCompleted = currentMatch && currentMatch.status === 'completed';

              return (
                <div
                  key={court.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                    isPlaying
                      ? 'bg-court-lightCard dark:bg-court-darkCard border-pickle-500/40 shadow-sm'
                      : isCompleted
                      ? 'bg-court-lightCard/70 dark:bg-court-darkCard/70 border-court-lightBorder dark:border-court-darkBorder'
                      : 'bg-court-lightBg dark:bg-court-darkBg/50 border-dashed border-court-lightBorder dark:border-court-darkBorder'
                  }`}
                >
                  {/* Court Header */}
                  <div className="flex items-center justify-between border-b border-court-lightBorder dark:border-court-darkBorder pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-court-darkBg dark:text-white">
                        {court.courtName}
                      </span>
                      {isPlaying && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          Playing Round {currentMatch?.roundNumber}
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-500 dark:text-gray-400">
                          Match Completed
                        </span>
                      )}
                      {!currentMatch && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-pickle-400/20 text-pickle-700 dark:text-pickle-300">
                          Available
                        </span>
                      )}
                    </div>

                    {isPlaying && currentMatch?.liveState && (
                      <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-pickle-400/20 text-pickle-600 dark:text-pickle-400 border border-pickle-400/30">
                        {currentMatch.liveState.scoreCall}
                      </span>
                    )}
                  </div>

                  {/* Court Match Content */}
                  {currentMatch ? (
                    <div className="py-4 space-y-3">
                      {/* Team A vs Team B */}
                      <div className="space-y-2">
                        {/* Team A */}
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                            currentMatch.winningTeam === 'teamA'
                              ? 'bg-pickle-400/15 border-pickle-500 font-extrabold text-court-darkBg dark:text-white'
                              : 'bg-court-lightBg dark:bg-court-darkBg border-court-lightBorder dark:border-court-darkBorder'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block">
                              Team A
                            </span>
                            <span className="font-bold text-court-darkBg dark:text-white">
                              {currentMatch.teamA.playerNames.join(' & ')}
                            </span>
                          </div>
                          <div className="text-xl font-black text-court-darkBg dark:text-white px-2">
                            {currentMatch.scoreA}
                          </div>
                        </div>

                        {/* Team B */}
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                            currentMatch.winningTeam === 'teamB'
                              ? 'bg-pickle-400/15 border-pickle-500 font-extrabold text-court-darkBg dark:text-white'
                              : 'bg-court-lightBg dark:bg-court-darkBg border-court-lightBorder dark:border-court-darkBorder'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block">
                              Team B
                            </span>
                            <span className="font-bold text-court-darkBg dark:text-white">
                              {currentMatch.teamB.playerNames.join(' & ')}
                            </span>
                          </div>
                          <div className="text-xl font-black text-court-darkBg dark:text-white px-2">
                            {currentMatch.scoreB}
                          </div>
                        </div>
                      </div>

                      {/* Match Meta */}
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span>
                          Target {currentMatch.targetScore} ({currentMatch.winCondition.replace('_', ' ')})
                        </span>
                        {isCompleted && (
                          <span className="capitalize">
                            Recorded via {currentMatch.scoringMethod}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-gray-400">
                      Court is ready for the next match assignment.
                    </div>
                  )}

                  {/* Court Actions */}
                  <div className="pt-2 border-t border-court-lightBorder dark:border-court-darkBorder flex items-center gap-2">
                    {isPlaying && currentMatch ? (
                      <>
                        <button
                          onClick={() => setActiveLiveMatch(currentMatch)}
                          className="flex-1 py-2 px-3 rounded-xl bg-pickle-400 hover:bg-pickle-300 text-court-darkBg font-black text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-court-darkBg" />
                          <span>Live Scoreboard</span>
                        </button>
                        <button
                          onClick={() => setActiveManualMatch(currentMatch)}
                          className="py-2 px-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg hover:bg-gray-200 dark:hover:bg-court-darkCardHover border border-court-lightBorder dark:border-court-darkBorder text-court-darkBg dark:text-white font-bold text-xs transition-all"
                        >
                          Final Score
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleGenerateNextRound}
                        className="w-full py-2 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder hover:bg-pickle-400/20 text-xs font-bold text-gray-500 hover:text-court-darkBg dark:hover:text-pickle-400 transition-colors"
                      >
                        Assign Players
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Waiting Queue & Player Rotation Tracker */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-court-lightBorder dark:border-court-darkBorder pb-2">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-court-darkBg dark:text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-pickle-500" />
                Waiting Queue ({waitingParticipants.length})
              </h3>
            </div>

            {waitingParticipants.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                No players currently waiting. All active participants are on court!
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {waitingParticipants.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full bg-pickle-400/20 text-pickle-700 dark:text-pickle-300 font-extrabold flex items-center justify-center text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-court-darkBg dark:text-white truncate">
                        {p.playerName}
                      </span>
                      {p.isGuest && (
                        <span className="text-[9px] uppercase px-1 rounded bg-gray-400/20 text-gray-400">
                          Guest
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 shrink-0 font-medium ml-2">
                      {p.gamesPlayed || 0} games
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session Player Stats Summary Widget */}
          <div className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder shadow-sm space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-court-darkBg dark:text-white">
              Session Roster ({participants.length})
            </h4>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-1 border-b border-court-lightBorder/50 dark:border-court-darkBorder/50 text-[11px]"
                >
                  <span className="font-medium text-court-darkBg dark:text-white truncate">
                    {p.playerName}
                  </span>
                  <div className="flex items-center gap-2 text-gray-400 shrink-0">
                    <span>
                      <strong className="text-court-darkBg dark:text-white">{p.gamesPlayed}</strong> gp
                    </span>
                    <span>
                      <strong className="text-emerald-500">{p.wins}</strong>W -{' '}
                      <strong className="text-red-400">{p.losses}</strong>L
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Split-Color Live Scoreboard */}
      {activeLiveMatch && (
        <LiveScoreboard
          match={activeLiveMatch}
          session={session}
          onClose={() => {
            setActiveLiveMatch(null);
            loadData();
          }}
          onMatchCompleted={() => {
            setActiveLiveMatch(null);
            loadData();
          }}
        />
      )}

      {/* Manual Final Score Entry Modal */}
      {activeManualMatch && (
        <ManualFinalScoreModal
          match={activeManualMatch}
          session={session}
          onClose={() => setActiveManualMatch(null)}
          onScoreSaved={() => {
            setActiveManualMatch(null);
            loadData();
          }}
        />
      )}

      {/* Finish Session Confirmation Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder p-6 space-y-4 shadow-2xl text-court-darkBg dark:text-white">
            <h4 className="font-black text-lg text-court-darkBg dark:text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-pickle-500" />
              Finish Open Play Session?
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              This will conclude the active session, record final session standings, and update all player lifetime stats. You can always review this session in the Game History tab.
            </p>
            {activeMatches.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                There are {activeMatches.length} match(es) still marked in progress. Unfinished matches will be concluded.
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Keep Playing
              </button>
              <button
                onClick={handleFinishSession}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-pickle-400 hover:bg-pickle-300 text-court-darkBg shadow-md"
              >
                Finish & View Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
