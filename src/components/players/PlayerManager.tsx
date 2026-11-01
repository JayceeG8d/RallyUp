'use client';

import React, { useState, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Trophy,
  History,
  Activity,
  ArrowUpRight,
  X,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  Camera,
  Upload,
  Star,
  Sparkles,
} from 'lucide-react';
import { Player, Match } from '@/types';
import { PlayerRepo, AVATAR_COLORS } from '@/lib/db/repository';
import { SKILL_LEVELS, SkillLevel, parseSkillLevelNumber } from '@/lib/rating/ratingEngine';
import { processProfileImage } from '@/lib/utils/imageUtils';

interface PlayerManagerProps {
  players: Player[];
  matches: Match[];
  onPlayerUpdated: () => void;
}

export function PlayerManager({
  players,
  matches,
  onPlayerUpdated,
}: PlayerManagerProps) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formSkillLevel, setFormSkillLevel] = useState<string>('Newbie / 2.0');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string>('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formColor, setFormColor] = useState(AVATAR_COLORS[0]);
  const [formError, setFormError] = useState('');
  const [processingPhoto, setProcessingPhoto] = useState(false);

  // Hidden file input refs for Take Photo and Upload Photo
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePlayers = players.filter((p) => !p.isArchived);
  const filteredPlayers = activePlayers.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateModal = () => {
    setEditingPlayer(null);
    setFormName('');
    setFormSkillLevel('Newbie / 2.0');
    setFormPhotoUrl('');
    setFormEmail('');
    setFormPhone('');
    setFormNotes('');
    setFormColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
    setFormError('');
    setShowAddModal(true);
  };

  const openEditModal = (player: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlayer(player);
    setFormName(player.name);
    setFormSkillLevel(player.skillLevel || 'Newbie / 2.0');
    setFormPhotoUrl(player.photoUrl || '');
    setFormEmail(player.email || '');
    setFormPhone(player.phone || '');
    setFormNotes(player.notes || '');
    setFormColor(player.avatarColor || AVATAR_COLORS[0]);
    setFormError('');
    setShowAddModal(true);
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessingPhoto(true);
      const dataUrl = await processProfileImage(file, 256, 0.85);
      setFormPhotoUrl(dataUrl);
    } catch (err: any) {
      setFormError('Failed to load image: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessingPhoto(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleSavePlayer = async () => {
    setFormError('');
    if (!formName.trim()) {
      setFormError('Player name is required.');
      return;
    }

    try {
      if (editingPlayer) {
        await PlayerRepo.update(editingPlayer.id, {
          name: formName.trim(),
          skillLevel: formSkillLevel,
          photoUrl: formPhotoUrl || undefined,
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          notes: formNotes.trim() || undefined,
          avatarColor: formColor,
        });
      } else {
        await PlayerRepo.create({
          name: formName.trim(),
          skillLevel: formSkillLevel,
          photoUrl: formPhotoUrl || undefined,
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          notes: formNotes.trim() || undefined,
          avatarColor: formColor,
        });
      }

      setShowAddModal(false);
      onPlayerUpdated();
    } catch (err: any) {
      setFormError(err.message || 'Error saving player');
    }
  };

  const handleConfirmDelete = async () => {
    if (!playerToDelete) return;
    try {
      // Soft deletion to protect historical match records
      await PlayerRepo.archive(playerToDelete.id);
      setPlayerToDelete(null);
      if (selectedPlayer?.id === playerToDelete.id) {
        setSelectedPlayer(null);
      }
      onPlayerUpdated();
    } catch (err) {
      console.error('Error archiving player:', err);
    }
  };

  // Find matches for selected player
  const playerMatches = selectedPlayer
    ? matches.filter(
        (m) =>
          m.teamA.playerIds.includes(selectedPlayer.id) ||
          m.teamB.playerIds.includes(selectedPlayer.id)
      )
    : [];

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-court-lightBorder dark:border-court-darkBorder pb-4">
        <div>
          <h2 className="text-2xl font-black text-court-darkBg dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-pickle-500" />
            Saved Players ({activePlayers.length})
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Player roster, skill levels, photos, dynamic ratings, and match history records.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pickle-400 hover:bg-pickle-300 text-court-darkBg font-black text-xs tracking-wider uppercase shadow-md transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Player</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players by name..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder text-sm text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400 shadow-sm"
        />
      </div>

      {/* Players Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-court-lightBorder dark:border-court-darkBorder p-8 space-y-3">
          <Users className="w-10 h-10 text-gray-400 mx-auto" />
          <h4 className="font-bold text-base text-court-darkBg dark:text-white">
            No players found
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {search
              ? 'No players match your search filter.'
              : 'Add your first pickleball player to build your open play roster!'}
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-pickle-400 text-court-darkBg font-bold text-xs"
          >
            Add New Player
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlayers.map((player) => {
            const gp = player.stats.gamesPlayed || 0;
            const wins = player.stats.wins || 0;
            const winPct = gp > 0 ? Math.round((wins / gp) * 100) : 0;
            const ptDiff = (player.stats.pointsScored || 0) - (player.stats.pointsConceded || 0);
            const currentRating = player.rating ?? parseSkillLevelNumber(player.skillLevel);

            return (
              <div
                key={player.id}
                onClick={() => setSelectedPlayer(player)}
                className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder hover:border-pickle-400/50 shadow-sm cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between space-y-4 group"
              >
                {/* Player Top row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Profile Picture or Colored Initials */}
                    {player.photoUrl ? (
                      <img
                        src={player.photoUrl}
                        alt={player.name}
                        className="w-12 h-12 rounded-xl object-cover ring-2 ring-pickle-400/30 shrink-0 shadow-sm"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0"
                        style={{ backgroundColor: player.avatarColor || '#059669' }}
                      >
                        {player.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-black text-base text-court-darkBg dark:text-white group-hover:text-pickle-600 dark:group-hover:text-pickle-400 transition-colors truncate">
                          {player.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-pickle-400/20 text-pickle-700 dark:text-pickle-300 border border-pickle-400/30">
                          {player.skillLevel || '3.0'}
                        </span>
                        <span className="flex items-center gap-0.5 text-[11px] font-extrabold text-amber-500">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {currentRating.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={(e) => openEditModal(player, e)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-court-darkCardHover transition-colors"
                      title="Edit player"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayerToDelete(player);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Delete player"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Lifetime Stats Strip */}
                <div className="grid grid-cols-4 gap-1.5 py-2 px-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-center">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">
                      Matches
                    </span>
                    <span className="text-sm font-black text-court-darkBg dark:text-white">
                      {gp}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">
                      Win %
                    </span>
                    <span className="text-sm font-black text-emerald-500">
                      {winPct}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">
                      Pt Diff
                    </span>
                    <span
                      className={`text-sm font-black ${
                        ptDiff >= 0 ? 'text-pickle-500' : 'text-red-400'
                      }`}
                    >
                      {ptDiff >= 0 ? `+${ptDiff}` : ptDiff}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">
                      Rating
                    </span>
                    <span className="text-sm font-black text-amber-500">
                      {currentRating.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Footer preview */}
                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-court-lightBorder dark:border-court-darkBorder">
                  <span>
                    Record: <strong className="text-emerald-500">{wins}W</strong> -{' '}
                    <strong className="text-red-400">{player.stats.losses || 0}L</strong>
                  </span>
                  <span className="flex items-center gap-0.5 text-pickle-600 dark:text-pickle-400 font-bold group-hover:translate-x-0.5 transition-transform">
                    View Stats <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Player Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder p-6 space-y-5 shadow-2xl text-court-darkBg dark:text-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-court-lightBorder dark:border-court-darkBorder pb-3">
              <h3 className="font-black text-xl text-court-darkBg dark:text-white">
                {editingPlayer ? 'Edit Player Profile' : 'Add New Player'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold">
                {formError}
              </div>
            )}

            {/* Profile Picture Section ("Take Photo" or "Upload Photo") */}
            <div className="p-4 rounded-2xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder space-y-3">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                Profile Picture (Take or Upload Photo)
              </label>

              <div className="flex items-center gap-4">
                {/* Photo Preview Circle */}
                <div className="relative w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-pickle-400/40 shadow-inner bg-court-darkHeader flex items-center justify-center">
                  {formPhotoUrl ? (
                    <img
                      src={formPhotoUrl}
                      alt="Player Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-white font-black text-lg"
                      style={{ backgroundColor: formColor }}
                    >
                      {formName ? formName[0]?.toUpperCase() : <Users className="w-7 h-7 text-white/80" />}
                    </div>
                  )}
                  {processingPhoto && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] text-pickle-400 font-bold">
                      ...
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-pickle-400 text-court-darkBg hover:bg-pickle-300 shadow-sm transition-all active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Take Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder text-court-darkBg dark:text-white hover:bg-gray-200 dark:hover:bg-court-darkCardHover transition-all active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                  </button>

                  {formPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormPhotoUrl('')}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Remove photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {/* Hidden File Inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handlePhotoFileChange}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoFileChange}
                />
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Ben Johns"
                className="w-full px-3.5 py-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-sm text-court-darkBg dark:text-white focus:outline-none focus:ring-2 focus:ring-pickle-400"
              />
            </div>

            {/* Pickleball Skill Level Selector (Exact design from user screenshot) */}
            <div className="p-4 rounded-2xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🏓</span>
                <label className="text-xs font-extrabold uppercase tracking-wider text-court-darkBg dark:text-white">
                  What is your Pickleball skill level? *
                </label>
              </div>

              {/* Skill level pill buttons */}
              <div className="flex flex-wrap gap-2">
                {SKILL_LEVELS.map((level) => {
                  const isSelected = formSkillLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormSkillLevel(level)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-white shadow-md scale-105 ring-2 ring-emerald-400'
                          : 'bg-court-lightCard dark:bg-court-darkCard text-gray-700 dark:text-gray-300 border border-court-lightBorder dark:border-court-darkBorder hover:border-emerald-500/50'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-gray-400">
                Initial level calibrates your starting rating (Est. DUPR). Dynamic performance rating updates automatically after each match.
              </p>
            </div>

            {/* Avatar Color (used as fallback when no photo) */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                Avatar Theme Color (Fallback)
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {AVATAR_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setFormColor(col)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      formColor === col ? 'scale-125 ring-2 ring-white shadow-md' : 'opacity-70'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="ben@pickleball.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs text-court-darkBg dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full px-3.5 py-2 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs text-court-darkBg dark:text-white"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                Notes / Skill Assessment (optional)
              </label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Prefers right court side, strong third shot drop"
                className="w-full px-3.5 py-2 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs text-court-darkBg dark:text-white"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-court-lightBorder dark:border-court-darkBorder">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePlayer}
                className="px-6 py-2.5 rounded-xl text-xs font-black bg-pickle-400 hover:bg-pickle-300 text-court-darkBg shadow-md transition-all active:scale-95"
              >
                {editingPlayer ? 'Save Changes' : 'Create Player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Detail & Match History Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[88vh] rounded-3xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder p-6 space-y-5 shadow-2xl text-court-darkBg dark:text-white flex flex-col">
            {/* Header with Photo & Skill Level */}
            <div className="flex items-center justify-between border-b border-court-lightBorder dark:border-court-darkBorder pb-4 shrink-0">
              <div className="flex items-center gap-3">
                {selectedPlayer.photoUrl ? (
                  <img
                    src={selectedPlayer.photoUrl}
                    alt={selectedPlayer.name}
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-pickle-400 shrink-0 shadow-md"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-2xl text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md"
                    style={{ backgroundColor: selectedPlayer.avatarColor || '#059669' }}
                  >
                    {selectedPlayer.name[0]}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-xl text-court-darkBg dark:text-white">
                      {selectedPlayer.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-xs font-black bg-pickle-400/20 text-pickle-700 dark:text-pickle-300 border border-pickle-400/40">
                      Level {selectedPlayer.skillLevel || '3.0'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Member since {new Date(selectedPlayer.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lifetime KPI Grid with Dynamic Rating */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">
                  Dynamic Rating
                </span>
                <span className="text-xl font-black text-amber-500 flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {(selectedPlayer.rating ?? parseSkillLevelNumber(selectedPlayer.skillLevel)).toFixed(2)}
                </span>
                <span className="text-[9px] text-gray-400">Est. DUPR</span>
              </div>

              <div className="p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">
                  Matches Played
                </span>
                <span className="text-xl font-black text-court-darkBg dark:text-white">
                  {selectedPlayer.stats.gamesPlayed}
                </span>
                <span className="text-[9px] text-gray-400">Lifetime</span>
              </div>

              <div className="p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">
                  Win / Loss
                </span>
                <span className="text-xl font-black text-emerald-500">
                  {selectedPlayer.stats.wins}W - {selectedPlayer.stats.losses}L
                </span>
                <span className="text-[9px] text-gray-400">
                  {selectedPlayer.stats.gamesPlayed > 0
                    ? Math.round(
                        (selectedPlayer.stats.wins / selectedPlayer.stats.gamesPlayed) * 100
                      )
                    : 0}
                  % Win Rate
                </span>
              </div>

              <div className="p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">
                  Point Differential
                </span>
                <span
                  className={`text-xl font-black ${
                    (selectedPlayer.stats.pointsScored - selectedPlayer.stats.pointsConceded) >= 0
                      ? 'text-pickle-500'
                      : 'text-red-400'
                  }`}
                >
                  {(selectedPlayer.stats.pointsScored - selectedPlayer.stats.pointsConceded) >= 0
                    ? `+${selectedPlayer.stats.pointsScored - selectedPlayer.stats.pointsConceded}`
                    : selectedPlayer.stats.pointsScored - selectedPlayer.stats.pointsConceded}
                </span>
                <span className="text-[9px] text-gray-400">
                  {selectedPlayer.stats.pointsScored} / {selectedPlayer.stats.pointsConceded}
                </span>
              </div>
            </div>

            {/* Match History List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-court-darkBg dark:text-white">
                Match History ({playerMatches.length})
              </h4>
              {playerMatches.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">
                  No recorded matches for this player yet.
                </p>
              ) : (
                playerMatches.map((m) => {
                  const isTeamA = m.teamA.playerIds.includes(selectedPlayer.id);
                  const isWinner =
                    (isTeamA && m.winningTeam === 'teamA') ||
                    (!isTeamA && m.winningTeam === 'teamB');

                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-black text-[10px] uppercase px-1.5 py-0.5 rounded ${
                              isWinner
                                ? 'bg-emerald-500/20 text-emerald-500'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {isWinner ? 'WIN' : 'LOSS'}
                          </span>
                          <span className="font-bold text-court-darkBg dark:text-white">
                            Court {m.courtNumber} • Round {m.roundNumber}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {m.teamA.playerNames.join(' & ')} vs {m.teamB.playerNames.join(' & ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-sm text-court-darkBg dark:text-white">
                          {m.scoreA} — {m.scoreB}
                        </span>
                        <p className="text-[10px] text-gray-400">
                          {m.scoringMethod === 'live' ? 'Live scored' : 'Manual'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-court-lightBorder dark:border-court-darkBorder flex justify-end shrink-0">
              <button
                onClick={() => setSelectedPlayer(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-court-darkBg dark:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Archive Player Confirmation Modal */}
      {playerToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder p-6 space-y-4 shadow-2xl text-court-darkBg dark:text-white">
            <h4 className="font-black text-lg text-court-darkBg dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Archive Player?
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Are you sure you want to remove <strong>{playerToDelete.name}</strong> from the roster? Their historical match records and stats will be preserved safely.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPlayerToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-black bg-red-500 hover:bg-red-600 text-white shadow-md"
              >
                Archive Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
