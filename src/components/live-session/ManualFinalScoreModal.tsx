'use client';

import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import { Match, Session } from '@/types';
import { validateManualScore } from '@/lib/scoring/scoringEngine';
import { MatchRepo } from '@/lib/db/repository';

interface ManualFinalScoreModalProps {
  match: Match;
  session: Session;
  onClose: () => void;
  onScoreSaved: () => void;
}

export function ManualFinalScoreModal({
  match,
  session,
  onClose,
  onScoreSaved,
}: ManualFinalScoreModalProps) {
  const [scoreA, setScoreA] = useState<string>(match.scoreA ? String(match.scoreA) : '');
  const [scoreB, setScoreB] = useState<string>(match.scoreB ? String(match.scoreB) : '');
  const [isOverride, setIsOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const numA = parseInt(scoreA, 10);
  const numB = parseInt(scoreB, 10);

  const validation = !isNaN(numA) && !isNaN(numB)
    ? validateManualScore(numA, numB, session.targetScore, session.winCondition)
    : { isValid: false, message: 'Please enter scores for both teams.' };

  const handleSave = async () => {
    setErrorMsg('');

    if (isNaN(numA) || isNaN(numB)) {
      setErrorMsg('Please enter valid numeric scores for both teams.');
      return;
    }

    if (!validation.isValid && !isOverride) {
      setErrorMsg(validation.message || 'Score does not satisfy the match win condition.');
      return;
    }

    if (numA === numB) {
      setErrorMsg('Pickleball matches cannot end in a tie.');
      return;
    }

    const winningTeam = numA > numB ? 'teamA' : 'teamB';

    try {
      setSaving(true);
      await MatchRepo.completeMatch(match.id, {
        scoreA: numA,
        scoreB: numB,
        winningTeam,
        scoringMethod: 'manual',
        overrideReason: isOverride ? overrideReason || 'Manual administrative override' : undefined,
        isOverrideWin: isOverride,
      });

      onScoreSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save match score.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder p-6 space-y-5 shadow-2xl text-court-darkBg dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-court-lightBorder dark:border-court-darkBorder pb-3">
          <div>
            <h4 className="font-black text-lg text-court-darkBg dark:text-white">
              Enter Final Score
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Court {match.courtNumber} • Target: {session.targetScore} ({session.winCondition.replace('_', ' ')})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Teams and Score inputs */}
        <div className="grid grid-cols-2 gap-4">
          {/* Team A */}
          <div className="p-4 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder space-y-2 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Team A
            </span>
            <div className="text-xs font-bold text-court-darkBg dark:text-white truncate">
              {match.teamA.playerNames.join(' & ')}
            </div>
            <input
              type="number"
              min="0"
              max="99"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              placeholder="0"
              className="w-full text-center text-4xl font-black py-2 rounded-xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400"
            />
          </div>

          {/* Team B */}
          <div className="p-4 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder space-y-2 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Team B
            </span>
            <div className="text-xs font-bold text-court-darkBg dark:text-white truncate">
              {match.teamB.playerNames.join(' & ')}
            </div>
            <input
              type="number"
              min="0"
              max="99"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              placeholder="0"
              className="w-full text-center text-4xl font-black py-2 rounded-xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400"
            />
          </div>
        </div>

        {/* Validation status badge */}
        {!isNaN(numA) && !isNaN(numB) && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              validation.isValid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
            }`}
          >
            <span>
              {validation.isValid
                ? `Valid result: Winner is ${validation.winner === 'teamA' ? 'Team A' : 'Team B'}`
                : validation.message}
            </span>
            {validation.isValid && <CheckCircle className="w-4 h-4 shrink-0" />}
          </div>
        )}

        {/* Exceptional Result / Override Toggle */}
        <div className="space-y-2 pt-1 border-t border-court-lightBorder dark:border-court-darkBorder">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isOverride}
              onChange={(e) => setIsOverride(e.target.checked)}
              className="rounded border-gray-400 text-pickle-500 focus:ring-pickle-400"
            />
            <span>Exceptional result / Administrative override</span>
          </label>
          {isOverride && (
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Override reason (e.g. Session ended, timed match, retirement)"
              className="w-full px-3 py-1.5 rounded-lg bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs text-court-darkBg dark:text-white"
            />
          )}
        </div>

        {/* Modal Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-pickle-400 hover:bg-pickle-300 text-court-darkBg shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Confirm Final Score'}
          </button>
        </div>
      </div>
    </div>
  );
}
