'use client';

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  X,
  Volume2,
  VolumeX,
  ChevronLeft,
  Flame,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { Match, Session } from '@/types';
import { ScoringEngine, isMatchWon } from '@/lib/scoring/scoringEngine';
import { MatchRepo } from '@/lib/db/repository';
import confetti from 'canvas-confetti';

interface LiveScoreboardProps {
  match: Match;
  session: Session;
  onClose: () => void;
  onMatchCompleted: () => void;
}

export function LiveScoreboard({
  match,
  session,
  onClose,
  onMatchCompleted,
}: LiveScoreboardProps) {
  // Initialize scoring engine with existing match state or default
  const [engine, setEngine] = useState<ScoringEngine>(() => {
    return new ScoringEngine(
      {
        format: match.matchFormat,
        scoringFormat: match.scoringFormat,
        targetScore: match.targetScore,
        winCondition: match.winCondition,
      },
      match.liveState ? {
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        servingTeam: match.liveState.servingTeam,
        serverNumber: match.liveState.serverNumber,
        servingSide: match.liveState.servingSide,
        servingPlayerIndex: match.liveState.servingPlayerIndex,
        scoreCall: match.liveState.scoreCall,
        positions: {
          teamA: { rightPlayerIndex: 0, leftPlayerIndex: 1 },
          teamB: { rightPlayerIndex: 0, leftPlayerIndex: 1 },
        },
      } : undefined
    );
  });

  const [scoreState, setScoreState] = useState(engine.state);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishError, setFinishError] = useState('');
  const [isOverrideAllowed, setIsOverrideAllowed] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sync state to Dexie on scoring changes
  const persistState = async (newEngine: ScoringEngine) => {
    setScoreState({ ...newEngine.state });
    try {
      await MatchRepo.saveLiveState(
        match.id,
        {
          servingTeam: newEngine.state.servingTeam,
          serverNumber: newEngine.state.serverNumber,
          servingSide: newEngine.state.servingSide,
          servingPlayerIndex: newEngine.state.servingPlayerIndex,
          scoreCall: newEngine.state.scoreCall,
          history: [],
        },
        newEngine.state.scoreA,
        newEngine.state.scoreB
      );
    } catch (err) {
      console.error('Failed to auto-save live score:', err);
    }
  };

  const handlePoint = (team: 'teamA' | 'teamB') => {
    engine.rallyWonBy(team);
    persistState(engine);

    // If match won, trigger celebratory confetti!
    if (engine.isMatchComplete()) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#bbf226', '#10b981', '#ffffff'],
        });
      } catch (e) {}
    }
  };

  const handleUndo = () => {
    const success = engine.undo();
    if (success) {
      persistState(engine);
    }
  };

  const isComplete = engine.isMatchComplete();
  const winningTeam = engine.getWinningTeam();

  const handleFinishMatch = async () => {
    if (!isComplete && !isOverrideAllowed) {
      setFinishError(
        `Match has not met target score (${session.targetScore}) or win condition (${session.winCondition.replace('_', ' ')}). Check administrative override to complete early.`
      );
      return;
    }

    const determinedWinner =
      winningTeam || (scoreState.scoreA > scoreState.scoreB ? 'teamA' : 'teamB');

    try {
      await MatchRepo.completeMatch(match.id, {
        scoreA: scoreState.scoreA,
        scoreB: scoreState.scoreB,
        winningTeam: determinedWinner,
        scoringMethod: 'live',
        overrideReason: !isComplete ? overrideReason || 'Early finish / Administrative result' : undefined,
        isOverrideWin: !isComplete,
      });

      onMatchCompleted();
    } catch (err: any) {
      setFinishError(err.message || 'Failed to complete match.');
    }
  };

  // Identify serving player name
  const servingTeamPlayers =
    scoreState.servingTeam === 'teamA' ? match.teamA.playerNames : match.teamB.playerNames;
  const servingPlayerName =
    servingTeamPlayers[scoreState.servingPlayerIndex] || servingTeamPlayers[0];

  return (
    <div className="fixed inset-0 z-50 bg-court-darkBg flex flex-col text-white select-none">
      {/* Top Header Bar */}
      <div className="h-14 px-4 bg-court-darkHeader border-b border-court-darkBorder flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Exit Scoreboard</span>
        </button>

        <div className="text-center">
          <span className="text-xs uppercase font-extrabold tracking-wider text-pickle-400">
            Court {match.courtNumber}
          </span>
          <p className="text-[11px] text-gray-400 font-medium">
            {match.matchFormat.toUpperCase()} • {session.scoringFormat === 'sideout' ? 'Side-Out' : 'Rally'} • First to {session.targetScore} ({session.winCondition.replace('_', ' ')})
          </p>
        </div>

        <button
          onClick={() => setShowFinishConfirm(true)}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
            isComplete
              ? 'bg-pickle-400 text-court-darkBg animate-bounce shadow-lg font-black'
              : 'bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 border border-emerald-500/30'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Finish Match</span>
        </button>
      </div>

      {/* Official Score Call Banner */}
      <div className="py-2.5 px-4 bg-court-darkCard border-b border-court-darkBorder flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Score Call:
          </span>
          <span className="px-3 py-1 rounded-md bg-pickle-400/20 text-pickle-400 text-sm font-black tracking-widest border border-pickle-400/30">
            {scoreState.scoreCall}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">Server:</span>
          <span className="font-bold text-white flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-pickle-400 animate-ping inline-block" />
            {servingPlayerName}
            {match.matchFormat === 'doubles' && match.scoringFormat === 'sideout' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-pickle-300 border border-white/10">
                Server #{scoreState.serverNumber}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Split-Color Interactive Scoreboard Body */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-court-darkBorder p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
        {/* TEAM A SIDE */}
        <div
          onClick={() => handlePoint('teamA')}
          className={`relative rounded-2xl flex flex-col justify-between p-6 cursor-pointer transition-all border ${
            scoreState.servingTeam === 'teamA'
              ? 'bg-gradient-to-br from-emerald-950/80 to-court-darkCard border-pickle-400/40 shadow-inner'
              : 'bg-court-darkCard border-court-darkBorder opacity-90 hover:opacity-100'
          }`}
        >
          {/* Serve indicator badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-black tracking-wider px-2.5 py-1 rounded-md bg-white/10 text-gray-300">
                Team A
              </span>
              {scoreState.servingTeam === 'teamA' && (
                <span className="flex items-center gap-1.5 text-xs font-black text-pickle-400 px-2.5 py-1 rounded-md bg-pickle-400/20 border border-pickle-400/30">
                  <Flame className="w-3.5 h-3.5" />
                  SERVING
                </span>
              )}
            </div>

            {winningTeam === 'teamA' && (
              <span className="flex items-center gap-1 text-xs font-black text-amber-400 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                <Award className="w-3.5 h-3.5" /> WINNER
              </span>
            )}
          </div>

          {/* Giant Score Display */}
          <div className="text-center my-auto py-4">
            <div className="text-8xl sm:text-9xl md:text-[140px] font-black tracking-tighter text-white drop-shadow-lg">
              {scoreState.scoreA}
            </div>
            <p className="text-xs uppercase font-extrabold tracking-widest text-pickle-400/70 mt-2">
              TAP TO AWARD POINT
            </p>
          </div>

          {/* Player Names */}
          <div className="space-y-1">
            <div className="text-sm sm:text-base font-extrabold text-white truncate">
              {match.teamA.playerNames.join(' & ')}
            </div>
            <p className="text-[11px] text-gray-400">
              {match.teamA.playerNames.length} {match.matchFormat === 'doubles' ? 'players' : 'player'}
            </p>
          </div>
        </div>

        {/* TEAM B SIDE */}
        <div
          onClick={() => handlePoint('teamB')}
          className={`relative rounded-2xl flex flex-col justify-between p-6 cursor-pointer transition-all border ${
            scoreState.servingTeam === 'teamB'
              ? 'bg-gradient-to-br from-emerald-950/80 to-court-darkCard border-pickle-400/40 shadow-inner'
              : 'bg-court-darkCard border-court-darkBorder opacity-90 hover:opacity-100'
          }`}
        >
          {/* Serve indicator badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-black tracking-wider px-2.5 py-1 rounded-md bg-white/10 text-gray-300">
                Team B
              </span>
              {scoreState.servingTeam === 'teamB' && (
                <span className="flex items-center gap-1.5 text-xs font-black text-pickle-400 px-2.5 py-1 rounded-md bg-pickle-400/20 border border-pickle-400/30">
                  <Flame className="w-3.5 h-3.5" />
                  SERVING
                </span>
              )}
            </div>

            {winningTeam === 'teamB' && (
              <span className="flex items-center gap-1 text-xs font-black text-amber-400 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                <Award className="w-3.5 h-3.5" /> WINNER
              </span>
            )}
          </div>

          {/* Giant Score Display */}
          <div className="text-center my-auto py-4">
            <div className="text-8xl sm:text-9xl md:text-[140px] font-black tracking-tighter text-white drop-shadow-lg">
              {scoreState.scoreB}
            </div>
            <p className="text-xs uppercase font-extrabold tracking-widest text-pickle-400/70 mt-2">
              TAP TO AWARD POINT
            </p>
          </div>

          {/* Player Names */}
          <div className="space-y-1">
            <div className="text-sm sm:text-base font-extrabold text-white truncate">
              {match.teamB.playerNames.join(' & ')}
            </div>
            <p className="text-[11px] text-gray-400">
              {match.teamB.playerNames.length} {match.matchFormat === 'doubles' ? 'players' : 'player'}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="h-16 px-4 bg-court-darkHeader border-t border-court-darkBorder flex items-center justify-between gap-4 shrink-0">
        <button
          onClick={handleUndo}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/20 transition-all active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Undo Point</span>
        </button>

        <div className="text-center hidden sm:block">
          <span className="text-xs text-gray-400">
            Target: <span className="font-bold text-white">{session.targetScore}</span> pts • Lead required:{' '}
            <span className="font-bold text-white">{session.winCondition === 'win_by_2' ? '2' : '1'}</span>
          </span>
        </div>

        <button
          onClick={() => setShowFinishConfirm(true)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-pickle-400 hover:bg-pickle-300 text-court-darkBg font-black text-xs tracking-wider uppercase transition-all shadow-md active:scale-95"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Complete Match</span>
        </button>
      </div>

      {/* Finish Match Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-court-darkCard border border-court-darkBorder p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-lg text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-pickle-400" />
                Finish Match Confirmation
              </h4>
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-center">
              <span className="text-xs uppercase font-extrabold text-pickle-400">Final Score</span>
              <div className="text-4xl font-black">
                {scoreState.scoreA} — {scoreState.scoreB}
              </div>
              <p className="text-xs text-gray-300">
                Winner:{' '}
                <span className="font-bold text-white">
                  {scoreState.scoreA > scoreState.scoreB
                    ? match.teamA.playerNames.join(' & ')
                    : match.teamB.playerNames.join(' & ')}
                </span>
              </p>
            </div>

            {finishError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{finishError}</span>
              </div>
            )}

            {!isComplete && (
              <div className="space-y-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                <label className="flex items-center gap-2 font-bold text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOverrideAllowed}
                    onChange={(e) => setIsOverrideAllowed(e.target.checked)}
                    className="rounded border-amber-400 text-pickle-500 focus:ring-pickle-400"
                  />
                  <span>Record exceptional result / administrative override</span>
                </label>
                {isOverrideAllowed && (
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Reason (e.g. Time expired, player injury, agreed result)"
                    className="w-full px-3 py-1.5 rounded-lg bg-court-darkBg border border-court-darkBorder text-xs text-white"
                  />
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white"
              >
                Keep Playing
              </button>
              <button
                onClick={handleFinishMatch}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-pickle-400 hover:bg-pickle-300 text-court-darkBg shadow-md"
              >
                Confirm & Record Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
