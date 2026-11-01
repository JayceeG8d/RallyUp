'use client';

import React, { useState, useRef } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Target,
  Trophy,
  Shuffle,
  Plus,
  Check,
  AlertCircle,
  ArrowRight,
  UserPlus,
  Trash2,
  Camera,
  Upload,
} from 'lucide-react';
import {
  Player,
  MatchFormat,
  ScoringFormat,
  WinCondition,
  RotationMode,
} from '@/types';
import { SessionRepo, PlayerRepo } from '@/lib/db/repository';
import { generateNextRoundMatches } from '@/lib/rotation/rotationEngine';
import { db } from '@/lib/db/dexie';
import { SKILL_LEVELS } from '@/lib/rating/ratingEngine';
import { processProfileImage } from '@/lib/utils/imageUtils';

interface NewSessionWizardProps {
  savedPlayers: Player[];
  onSessionStarted: (sessionId: string) => void;
  onCancel: () => void;
  onPlayerCreated: () => void;
}

export function NewSessionWizard({
  savedPlayers,
  onSessionStarted,
  onCancel,
  onPlayerCreated,
}: NewSessionWizardProps) {
  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  // Form states
  const [name, setName] = useState(`Open Play ${today}`);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState(nowTime);
  const [location, setLocation] = useState('');
  const [numCourts, setNumCourts] = useState(2);
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('doubles');
  const [targetScore, setTargetScore] = useState(11);
  const [customScore, setCustomScore] = useState('');
  const [winCondition, setWinCondition] = useState<WinCondition>('win_by_2');
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>('sideout');
  const [rotationMode, setRotationMode] = useState<RotationMode>('fair');
  const [notes, setNotes] = useState('');

  // Player selection state
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [guestPlayers, setGuestPlayers] = useState<Array<{ id: string; name: string }>>([]);

  // Inline new player modal/drawer
  const [showInlineNewPlayer, setShowInlineNewPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [inlineSkillLevel, setInlineSkillLevel] = useState<string>('Newbie / 2.0');
  const [inlinePhotoUrl, setInlinePhotoUrl] = useState<string>('');
  const [guestCount, setGuestCount] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const inlineCameraRef = useRef<HTMLInputElement>(null);
  const inlineFileRef = useRef<HTMLInputElement>(null);

  const handleInlinePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processProfileImage(file, 256, 0.85);
      setInlinePhotoUrl(dataUrl);
    } catch (err: any) {
      setErrorMsg('Failed to process image: ' + (err.message || ''));
    } finally {
      e.target.value = '';
    }
  };

  // Calculations
  const totalSelectedCount = selectedPlayerIds.length + guestPlayers.length;
  const playersPerCourt = matchFormat === 'doubles' ? 4 : 2;
  const maxCourtSlots = numCourts * playersPerCourt;
  const minRequired = playersPerCourt;
  const waitingCount = Math.max(0, totalSelectedCount - maxCourtSlots);
  const activeCourtsSupported = Math.min(
    numCourts,
    Math.floor(totalSelectedCount / playersPerCourt)
  );

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const available = savedPlayers.filter((p) => !p.isArchived).map((p) => p.id);
    setSelectedPlayerIds(available);
  };

  const deselectAll = () => {
    setSelectedPlayerIds([]);
  };

  const handleAddGuest = () => {
    const guestId = `guest-${Date.now()}-${guestCount}`;
    const guestName = `Guest ${guestCount}`;
    setGuestPlayers((prev) => [...prev, { id: guestId, name: guestName }]);
    setGuestCount((c) => c + 1);
  };

  const handleRemoveGuest = (id: string) => {
    setGuestPlayers((prev) => prev.filter((g) => g.id !== id));
  };

  const handleCreateInlinePlayer = async () => {
    if (!newPlayerName.trim()) return;
    try {
      const created = await PlayerRepo.create({
        name: newPlayerName.trim(),
        skillLevel: inlineSkillLevel,
        photoUrl: inlinePhotoUrl || undefined,
      });
      setSelectedPlayerIds((prev) => [...prev, created.id]);
      setNewPlayerName('');
      setInlineSkillLevel('Newbie / 2.0');
      setInlinePhotoUrl('');
      setShowInlineNewPlayer(false);
      onPlayerCreated();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleStartSession = async () => {
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please enter a session name.');
      return;
    }

    if (totalSelectedCount < minRequired) {
      setErrorMsg(
        `At least ${minRequired} players are needed for ${matchFormat} play (currently ${totalSelectedCount}).`
      );
      return;
    }

    const finalTargetScore =
      targetScore === -1 ? parseInt(customScore, 10) || 11 : targetScore;

    try {
      // Build participants list
      const activeSaved = savedPlayers.filter((p) => selectedPlayerIds.includes(p.id));
      const participantsData = [
        ...activeSaved.map((p) => ({
          playerId: p.id,
          playerName: p.name,
          isGuest: false,
        })),
        ...guestPlayers.map((g) => ({
          playerId: g.id,
          playerName: g.name,
          isGuest: true,
        })),
      ];

      // 1. Create Session & Courts in Dexie
      const session = await SessionRepo.createSession(
        {
          name: name.trim(),
          date,
          startTime,
          location: location.trim() || undefined,
          numCourts,
          matchFormat,
          targetScore: finalTargetScore,
          winCondition,
          scoringFormat,
          rotationMode,
          notes: notes.trim() || undefined,
          status: 'active',
        },
        participantsData
      );

      // 2. Fetch freshly created courts and participants
      const createdCourts = await db.courts
        .where('sessionId')
        .equals(session.id)
        .toArray();
      const createdParticipants = await db.sessionParticipants
        .where('sessionId')
        .equals(session.id)
        .toArray();

      // 3. Automatically generate round 1 assignments
      const { matches: initialMatches, updatedParticipants } = generateNextRoundMatches({
        sessionId: session.id,
        roundNumber: 1,
        matchFormat,
        rotationMode,
        availableCourts: createdCourts,
        activeMatches: [],
        participants: createdParticipants,
      });

      // 4. Save initial matches and update courts and participants in Dexie
      await db.transaction(
        'rw',
        [db.matches, db.courts, db.sessionParticipants],
        async () => {
          for (const m of initialMatches) {
            await db.matches.add({
              ...m,
              scoringMethod: 'manual', // default until live score started
              scoringFormat,
              targetScore: finalTargetScore,
              winCondition,
              scoreA: 0,
              scoreB: 0,
              status: 'in_progress',
              winningTeam: null,
              startedAt: Date.now(),
            });

            // Update court status
            const court = createdCourts.find((c) => c.courtNumber === m.courtNumber);
            if (court) {
              await db.courts.update(court.id, {
                status: 'playing',
                currentMatchId: m.id,
              });
            }
          }

          // Update participant statuses
          for (const p of updatedParticipants) {
            await db.sessionParticipants.update(p.id, {
              status: p.status,
            });
          }
        }
      );

      onSessionStarted(session.id);
    } catch (err: any) {
      console.error('Error starting session:', err);
      setErrorMsg(err.message || 'Failed to start session.');
    }
  };

  const filteredSavedPlayers = savedPlayers
    .filter((p) => !p.isArchived)
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-court-lightBorder dark:border-court-darkBorder pb-4">
        <div>
          <h2 className="text-2xl font-black text-court-darkBg dark:text-white">
            Create Open Play Session
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Configure courts, scoring format, and player rotation rules.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-court-lightBorder dark:border-court-darkBorder text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Basic Session Details */}
      <div className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-court-darkBg dark:text-white">
          1. Session Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Session Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wednesday Morning Open Play"
              className="w-full px-3.5 py-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-sm text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Location / Facility
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Community Center Courts"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-sm text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-sm text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Start Time
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-sm text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rules & Format */}
      <div className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-court-darkBg dark:text-white">
          2. Match Rules & Court Configuration
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Number of Courts */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Number of Courts
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNumCourts((c) => Math.max(1, c - 1))}
                className="w-10 h-10 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder font-bold text-lg text-court-darkBg dark:text-white hover:bg-pickle-400 hover:text-court-darkBg transition-colors"
              >
                -
              </button>
              <div className="flex-1 text-center font-black text-lg py-1.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-court-darkBg dark:text-white">
                {numCourts}
              </div>
              <button
                type="button"
                onClick={() => setNumCourts((c) => Math.min(24, c + 1))}
                className="w-10 h-10 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder font-bold text-lg text-court-darkBg dark:text-white hover:bg-pickle-400 hover:text-court-darkBg transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Match Format */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Match Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMatchFormat('doubles')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  matchFormat === 'doubles'
                    ? 'bg-pickle-400 text-court-darkBg border-pickle-400 shadow-sm'
                    : 'bg-court-lightBg dark:bg-court-darkBg text-gray-600 dark:text-gray-300 border-court-lightBorder dark:border-court-darkBorder'
                }`}
              >
                Doubles (4p)
              </button>
              <button
                type="button"
                onClick={() => setMatchFormat('singles')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  matchFormat === 'singles'
                    ? 'bg-pickle-400 text-court-darkBg border-pickle-400 shadow-sm'
                    : 'bg-court-lightBg dark:bg-court-darkBg text-gray-600 dark:text-gray-300 border-court-lightBorder dark:border-court-darkBorder'
                }`}
              >
                Singles (2p)
              </button>
            </div>
          </div>

          {/* Scoring Format */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Scoring Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScoringFormat('sideout')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  scoringFormat === 'sideout'
                    ? 'bg-pickle-400 text-court-darkBg border-pickle-400 shadow-sm'
                    : 'bg-court-lightBg dark:bg-court-darkBg text-gray-600 dark:text-gray-300 border-court-lightBorder dark:border-court-darkBorder'
                }`}
              >
                Side-Out
              </button>
              <button
                type="button"
                onClick={() => setScoringFormat('rally')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  scoringFormat === 'rally'
                    ? 'bg-pickle-400 text-court-darkBg border-pickle-400 shadow-sm'
                    : 'bg-court-lightBg dark:bg-court-darkBg text-gray-600 dark:text-gray-300 border-court-lightBorder dark:border-court-darkBorder'
                }`}
              >
                Rally Scoring
              </button>
            </div>
          </div>

          {/* Target Score */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Target Score
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[11, 15, 21].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTargetScore(s)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    targetScore === s
                      ? 'bg-pickle-400 text-court-darkBg border-pickle-400'
                      : 'bg-court-lightBg dark:bg-court-darkBg text-gray-600 dark:text-gray-300 border-court-lightBorder dark:border-court-darkBorder'
                  }`}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTargetScore(-1)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  targetScore === -1
                    ? 'bg-pickle-400 text-court-darkBg border-pickle-400'
                    : 'bg-court-lightBg dark:bg-court-darkBg text-gray-600 dark:text-gray-300 border-court-lightBorder dark:border-court-darkBorder'
                }`}
              >
                Custom
              </button>
            </div>
            {targetScore === -1 && (
              <input
                type="number"
                min="5"
                max="50"
                value={customScore}
                onChange={(e) => setCustomScore(e.target.value)}
                placeholder="Enter points (e.g. 9)"
                className="mt-2 w-full px-3 py-1.5 rounded-lg bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs text-court-darkBg dark:text-white"
              />
            )}
          </div>

          {/* Win Condition */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Win Condition
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWinCondition('win_by_2')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  winCondition === 'win_by_2'
                    ? 'bg-pickle-400 text-court-darkBg border-pickle-400 shadow-sm'
                    : 'bg-court-lightBg dark:bg-court-darkBg text-gray-600 dark:text-gray-300 border-court-lightBorder dark:border-court-darkBorder'
                }`}
              >
                Win by 2
              </button>
              <button
                type="button"
                onClick={() => setWinCondition('win_by_1')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  winCondition === 'win_by_1'
                    ? 'bg-pickle-400 text-court-darkBg border-pickle-400 shadow-sm'
                    : 'bg-court-lightBg dark:bg-court-darkBg text-gray-600 dark:text-gray-300 border-court-lightBorder dark:border-court-darkBorder'
                }`}
              >
                Win by 1
              </button>
            </div>
          </div>

          {/* Rotation Mode */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Rotation Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'fair', label: 'Fair' },
                { id: 'partner', label: 'Partner' },
                { id: 'random', label: 'Random' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setRotationMode(m.id as RotationMode)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    rotationMode === m.id
                      ? 'bg-pickle-400 text-court-darkBg border-pickle-400 shadow-sm'
                      : 'bg-court-lightBg dark:bg-court-darkBg text-gray-600 dark:text-gray-300 border-court-lightBorder dark:border-court-darkBorder'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Player Participation Section */}
      <div className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-court-darkBg dark:text-white">
              3. Participating Players ({totalSelectedCount})
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Select saved players, add guests, or create new roster members.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddGuest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-pickle-400/20 text-pickle-700 dark:text-pickle-300 hover:bg-pickle-400/30 border border-pickle-400/40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Guest
            </button>
            <button
              type="button"
              onClick={() => setShowInlineNewPlayer(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-court-lightBg dark:bg-court-darkBg text-court-darkBg dark:text-white border border-court-lightBorder dark:border-court-darkBorder hover:bg-gray-200 dark:hover:bg-court-darkCardHover transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              New Player
            </button>
          </div>
        </div>

        {/* Real-time Court & Queue Status Indicator */}
        <div className="p-3.5 rounded-xl bg-pickle-400/10 border border-pickle-400/20 text-xs font-semibold text-pickle-800 dark:text-pickle-300 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-extrabold">{totalSelectedCount} Players</span> •{' '}
            <span>{maxCourtSlots} Court Spots ({numCourts} courts)</span>
          </div>
          <div>
            {waitingCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                {waitingCount} players will start in the Waiting Queue
              </span>
            ) : totalSelectedCount < maxCourtSlots ? (
              <span className="text-gray-500 dark:text-gray-400">
                {activeCourtsSupported} active court(s) will be filled initially
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                All {numCourts} courts perfectly filled!
              </span>
            )}
          </div>
        </div>

        {/* Temporary Guests List */}
        {guestPlayers.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Temporary Guests:
            </span>
            <div className="flex flex-wrap gap-2">
              {guestPlayers.map((guest) => (
                <div
                  key={guest.id}
                  className="flex items-center gap-2 px-3 py-1 rounded-full bg-pickle-400/20 border border-pickle-400/40 text-xs font-semibold text-court-darkBg dark:text-white"
                >
                  <span>{guest.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveGuest(guest.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick selection toolbar */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved players..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs text-court-darkBg dark:text-white"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-bold text-pickle-600 dark:text-pickle-400 hover:underline"
            >
              Select All
            </button>
            <span className="text-gray-400">•</span>
            <button
              type="button"
              onClick={deselectAll}
              className="text-xs font-bold text-gray-500 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Saved Player Chips Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-1">
          {filteredSavedPlayers.length === 0 ? (
            <p className="col-span-full text-center text-xs text-gray-400 py-6">
              No saved players match your search. Add one above!
            </p>
          ) : (
            filteredSavedPlayers.map((player) => {
              const isSelected = selectedPlayerIds.includes(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => togglePlayer(player.id)}
                  className={`flex items-center justify-between p-2 rounded-xl border text-left text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-pickle-400/20 border-pickle-500 text-court-darkBg dark:text-white ring-1 ring-pickle-400'
                      : 'bg-court-lightBg dark:bg-court-darkBg border-court-lightBorder dark:border-court-darkBorder text-gray-700 dark:text-gray-300 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {player.photoUrl ? (
                      <img
                        src={player.photoUrl}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-pickle-400"
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full text-[10px] text-white font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: player.avatarColor || '#059669' }}
                      >
                        {player.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="truncate">
                      <span className="truncate block font-bold text-xs">{player.name}</span>
                      <span className="text-[10px] text-gray-400 block -mt-0.5">
                        {player.skillLevel || '3.0'}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-pickle-500 text-court-darkBg flex items-center justify-center shrink-0 ml-1">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Start Session CTA */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={handleStartSession}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-pickle-400 hover:bg-pickle-300 text-court-darkBg font-black text-sm tracking-wide shadow-lg transition-all transform active:scale-95"
        >
          <span>Start Open Play Session</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Inline New Player Modal */}
      {showInlineNewPlayer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder p-5 space-y-4 shadow-2xl text-court-darkBg dark:text-white">
            <h4 className="font-black text-lg text-court-darkBg dark:text-white">
              Create New Player
            </h4>

            {/* Profile Picture Option */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-court-darkHeader border border-pickle-400/40 flex items-center justify-center shrink-0">
                {inlinePhotoUrl ? (
                  <img src={inlinePhotoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => inlineCameraRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-pickle-400 text-court-darkBg flex items-center gap-1 shadow-sm"
                >
                  <Camera className="w-3.5 h-3.5" /> Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => inlineFileRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload
                </button>
              </div>
              <input
                ref={inlineCameraRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleInlinePhoto}
              />
              <input
                ref={inlineFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleInlinePhoto}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                autoFocus
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Full Name (e.g. Tyson McGuffin)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-sm text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateInlinePlayer();
                }}
              />
            </div>

            {/* Pickleball Skill Level */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-court-darkBg dark:text-white">
                Pickleball Skill Level *
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SKILL_LEVELS.map((level) => {
                  const isSelected = inlineSkillLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setInlineSkillLevel(level)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-400'
                          : 'bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-court-lightBorder dark:border-court-darkBorder">
              <button
                type="button"
                onClick={() => setShowInlineNewPlayer(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateInlinePlayer}
                className="px-4 py-2 rounded-xl text-xs font-black bg-pickle-400 text-court-darkBg hover:bg-pickle-300 shadow-sm"
              >
                Add to Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
