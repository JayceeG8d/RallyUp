import { db } from './dexie';
import {
  Player,
  Session,
  SessionParticipant,
  Court,
  Match,
  AppSettings,
  BackupData,
} from '@/types';
import {
  parseSkillLevelNumber,
  calculateMatchRatingAdjustments,
} from '../rating/ratingEngine';
import { SupabaseSync } from '../supabase/syncService';

// Helper to generate UUIDs
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

// Player Avatar Colors (pickleball palette)
export const AVATAR_COLORS = [
  '#059669', // Emerald
  '#0284c7', // Sky Blue
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#dc2626', // Red
  '#0d9488', // Teal
  '#4f46e5', // Indigo
  '#ea580c', // Orange
  '#65a30d', // Pickleball Lime-Green
];

// --- PLAYER REPOSITORY ---
export const PlayerRepo = {
  async getAll(includeArchived = false): Promise<Player[]> {
    if (includeArchived) {
      return db.players.toArray();
    }
    return db.players.filter((p) => !p.isArchived).toArray();
  },

  async getById(id: string): Promise<Player | undefined> {
    return db.players.get(id);
  },

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    notes?: string;
    avatarColor?: string;
    skillLevel?: string;
    photoUrl?: string;
    isGuest?: boolean;
  }): Promise<Player> {
    const trimmedName = data.name.trim();
    if (!trimmedName) throw new Error('Player name cannot be empty');

    const randomColor =
      data.avatarColor ||
      AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const chosenSkill = data.skillLevel || '3.0';
    const initialRating = parseSkillLevelNumber(chosenSkill);

    const player: Player = {
      id: generateId(),
      name: trimmedName,
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      avatarColor: randomColor,
      photoUrl: data.photoUrl || undefined,
      skillLevel: chosenSkill,
      initialSkillLevel: chosenSkill,
      rating: initialRating,
      isGuest: Boolean(data.isGuest),
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsScored: 0,
        pointsConceded: 0,
      },
    };

    await db.players.add(player);
    SupabaseSync.syncPlayer(player);
    return player;
  },

  async update(id: string, updates: Partial<Player>): Promise<void> {
    await db.players.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    const updated = await db.players.get(id);
    if (updated) SupabaseSync.syncPlayer(updated);
  },

  async archive(id: string): Promise<void> {
    // Soft deletion preserves historical integrity
    await db.players.update(id, {
      isArchived: true,
      updatedAt: Date.now(),
    });
    const updated = await db.players.get(id);
    if (updated) SupabaseSync.syncPlayer(updated);
  },

  async deletePermanent(id: string): Promise<void> {
    await db.players.delete(id);
    SupabaseSync.deletePlayer(id);
  },
};

// --- SESSION REPOSITORY ---
export const SessionRepo = {
  async getAll(): Promise<Session[]> {
    return db.sessions.orderBy('createdAt').reverse().toArray();
  },

  async getById(id: string): Promise<Session | undefined> {
    return db.sessions.get(id);
  },

  async getActiveSession(): Promise<Session | undefined> {
    return db.sessions.where('status').equals('active').first();
  },

  async createSession(
    sessionData: Omit<Session, 'id' | 'createdAt' | 'currentRound'>,
    participants: Array<{ playerId: string; playerName: string; isGuest?: boolean }>
  ): Promise<Session> {
    const sessionId = generateId();
    const now = Date.now();

    const session: Session = {
      ...sessionData,
      id: sessionId,
      currentRound: 1,
      createdAt: now,
      startedAt: now,
    };

    // Create Courts
    const courts: Court[] = [];
    for (let i = 1; i <= session.numCourts; i++) {
      courts.push({
        id: generateId(),
        sessionId,
        courtNumber: i,
        courtName: `Court ${i}`,
        status: 'available',
      });
    }

    // Create Participants
    const sessionParticipants: SessionParticipant[] = participants.map(
      (p, index) => ({
        id: generateId(),
        sessionId,
        playerId: p.playerId,
        playerName: p.playerName,
        isGuest: p.isGuest || false,
        joinedAt: now,
        status: 'waiting',
        currentQueueOrder: index + 1,
        waitingSince: now,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsScored: 0,
        pointsConceded: 0,
      })
    );

    await db.transaction('rw', [db.sessions, db.courts, db.sessionParticipants], async () => {
      await db.sessions.add(session);
      await db.courts.bulkAdd(courts);
      await db.sessionParticipants.bulkAdd(sessionParticipants);
    });

    SupabaseSync.syncFullSessionState(sessionId);

    return session;
  },

  async completeSession(sessionId: string): Promise<void> {
    await db.sessions.update(sessionId, {
      status: 'completed',
      completedAt: Date.now(),
    });
    SupabaseSync.syncFullSessionState(sessionId);
  },

  async deleteSession(sessionId: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.sessions, db.courts, db.sessionParticipants, db.matches],
      async () => {
        await db.sessions.delete(sessionId);
        await db.courts.where('sessionId').equals(sessionId).delete();
        await db.sessionParticipants.where('sessionId').equals(sessionId).delete();
        await db.matches.where('sessionId').equals(sessionId).delete();
      }
    );
    SupabaseSync.deleteSession(sessionId);
  },
};

// --- MATCH & COURT REPOSITORY ---
export const MatchRepo = {
  async getBySession(sessionId: string): Promise<Match[]> {
    return db.matches.where('sessionId').equals(sessionId).toArray();
  },

  async getActiveMatches(sessionId: string): Promise<Match[]> {
    return db.matches
      .where('sessionId')
      .equals(sessionId)
      .filter((m) => m.status === 'in_progress')
      .toArray();
  },

  async getById(id: string): Promise<Match | undefined> {
    return db.matches.get(id);
  },

  async saveLiveState(matchId: string, liveState: Match['liveState'], scoreA: number, scoreB: number): Promise<void> {
    await db.matches.update(matchId, {
      liveState,
      scoreA,
      scoreB,
    });
    const updated = await db.matches.get(matchId);
    if (updated) SupabaseSync.syncMatches([updated]);
  },

  async completeMatch(
    matchId: string,
    result: {
      scoreA: number;
      scoreB: number;
      winningTeam: 'teamA' | 'teamB';
      scoringMethod: 'live' | 'manual';
      overrideReason?: string;
      isOverrideWin?: boolean;
    }
  ): Promise<void> {
    const match = await db.matches.get(matchId);
    if (!match) throw new Error('Match not found');

    // Prevent duplicate submission
    if (match.status === 'completed') {
      return;
    }

    const sessionId = match.sessionId;
    const now = Date.now();

    await db.transaction(
      'rw',
      [db.matches, db.courts, db.sessionParticipants, db.players],
      async () => {
        // 1. Update Match record
        await db.matches.update(matchId, {
          scoreA: result.scoreA,
          scoreB: result.scoreB,
          winningTeam: result.winningTeam,
          status: 'completed',
          scoringMethod: result.scoringMethod,
          overrideReason: result.overrideReason,
          isOverrideWin: result.isOverrideWin,
          completedAt: now,
        });

        // 2. Free up the court
        const court = await db.courts
          .where({ sessionId, courtNumber: match.courtNumber })
          .first();
        if (court) {
          await db.courts.update(court.id, {
            status: 'available',
            currentMatchId: undefined,
          });
        }

        // 3. Update Session Participants & Calculate Dynamic Ratings
        const allMatchPlayerIds = [...match.teamA.playerIds, ...match.teamB.playerIds];
        const participants = await db.sessionParticipants
          .where('sessionId')
          .equals(sessionId)
          .filter((p) => allMatchPlayerIds.includes(p.playerId))
          .toArray();

        // Fetch registered players for rating calculations
        const registeredPlayers = await db.players
          .filter((p) => allMatchPlayerIds.includes(p.id))
          .toArray();
        const playerMap = new Map(registeredPlayers.map((p) => [p.id, p]));

        const teamARatings = match.teamA.playerIds.map((id) => {
          const pl = playerMap.get(id);
          return pl?.rating ?? (pl?.skillLevel ? parseSkillLevelNumber(pl.skillLevel) : 3.0);
        });
        const teamBRatings = match.teamB.playerIds.map((id) => {
          const pl = playerMap.get(id);
          return pl?.rating ?? (pl?.skillLevel ? parseSkillLevelNumber(pl.skillLevel) : 3.0);
        });

        const ratingAdj = calculateMatchRatingAdjustments({
          teamARatings,
          teamBRatings,
          scoreA: result.scoreA,
          scoreB: result.scoreB,
          winningTeam: result.winningTeam,
        });

        // Get max current queue order in this session
        const allCurrentWaiting = await db.sessionParticipants
          .where('sessionId')
          .equals(sessionId)
          .toArray();
        let maxQueue = Math.max(0, ...allCurrentWaiting.map((p) => p.currentQueueOrder || 0));

        for (const p of participants) {
          const isTeamA = match.teamA.playerIds.includes(p.playerId);
          const isWinner =
            (isTeamA && result.winningTeam === 'teamA') ||
            (!isTeamA && result.winningTeam === 'teamB');

          const pointsScored = isTeamA ? result.scoreA : result.scoreB;
          const pointsConceded = isTeamA ? result.scoreB : result.scoreA;

          maxQueue++;
          await db.sessionParticipants.update(p.id, {
            gamesPlayed: (p.gamesPlayed || 0) + 1,
            wins: (p.wins || 0) + (isWinner ? 1 : 0),
            losses: (p.losses || 0) + (isWinner ? 0 : 1),
            pointsScored: (p.pointsScored || 0) + pointsScored,
            pointsConceded: (p.pointsConceded || 0) + pointsConceded,
            status: 'waiting',
            waitingSince: now,
            currentQueueOrder: maxQueue,
            lastCourtNumber: match.courtNumber,
          });

          // 4. Update Lifetime Player Stats and Dynamic Rating (if not temporary guest or if player exists)
          const player = playerMap.get(p.playerId) || (await db.players.get(p.playerId));
          if (player) {
            const currentRating = player.rating ?? parseSkillLevelNumber(player.skillLevel);
            const delta = isTeamA ? ratingAdj.deltaA : ratingAdj.deltaB;
            const updatedRating = Math.max(
              1.5,
              Math.min(8.0, parseFloat((currentRating + delta).toFixed(2)))
            );

            await db.players.update(player.id, {
              rating: updatedRating,
              stats: {
                gamesPlayed: (player.stats.gamesPlayed || 0) + 1,
                wins: (player.stats.wins || 0) + (isWinner ? 1 : 0),
                losses: (player.stats.losses || 0) + (isWinner ? 0 : 1),
                pointsScored: (player.stats.pointsScored || 0) + pointsScored,
                pointsConceded: (player.stats.pointsConceded || 0) + pointsConceded,
              },
              updatedAt: now,
            });
            const updatedPlayer = await db.players.get(player.id);
            if (updatedPlayer) SupabaseSync.syncPlayer(updatedPlayer);
          }
        }
      }
    );

    SupabaseSync.syncFullSessionState(sessionId);
  },
};

// --- APP SETTINGS REPOSITORY ---
export const SettingsRepo = {
  async getSettings(): Promise<AppSettings> {
    const existing = await db.appSettings.get('global-settings');
    if (existing) return existing;

    const defaultSettings: AppSettings = {
      id: 'global-settings',
      theme: 'dark',
      soundEnabled: true,
      defaultNumCourts: 2,
      defaultTargetScore: 11,
      defaultWinCondition: 'win_by_2',
      defaultScoringFormat: 'sideout',
      defaultMatchFormat: 'doubles',
      defaultRotationMode: 'fair',
    };
    await db.appSettings.put(defaultSettings);
    return defaultSettings;
  },

  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    await db.appSettings.put({
      ...current,
      ...updates,
    });
  },
};
