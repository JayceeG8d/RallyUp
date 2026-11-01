import { z } from 'zod';
import { db } from '../db/dexie';
import { BackupData, Player, Match, Session } from '@/types';

// Zod schemas for backup validation
const PlayerStatsSchema = z.object({
  gamesPlayed: z.number(),
  wins: z.number(),
  losses: z.number(),
  pointsScored: z.number(),
  pointsConceded: z.number(),
});

const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  avatarColor: z.string().optional(),
  photoUrl: z.string().optional(),
  skillLevel: z.string().optional(),
  initialSkillLevel: z.string().optional(),
  rating: z.number().optional(),
  isGuest: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  stats: PlayerStatsSchema,
});

const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string(),
  startTime: z.string(),
  location: z.string().optional(),
  numCourts: z.number(),
  matchFormat: z.enum(['doubles', 'singles']),
  targetScore: z.number(),
  winCondition: z.enum(['win_by_1', 'win_by_2']),
  scoringFormat: z.enum(['sideout', 'rally']),
  rotationMode: z.enum(['fair', 'random', 'partner']),
  notes: z.string().optional(),
  status: z.enum(['setup', 'active', 'completed']),
  currentRound: z.number(),
  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
});

const BackupSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  appName: z.literal('RallyUp'),
  players: z.array(PlayerSchema),
  sessions: z.array(SessionSchema),
  sessionParticipants: z.array(z.any()),
  courts: z.array(z.any()),
  matches: z.array(z.any()),
  appSettings: z.any().optional(),
});

export const BackupService = {
  /**
   * Export all data as a versioned JSON object
   */
  async exportJSON(): Promise<string> {
    const players = await db.players.toArray();
    const sessions = await db.sessions.toArray();
    const sessionParticipants = await db.sessionParticipants.toArray();
    const courts = await db.courts.toArray();
    const matches = await db.matches.toArray();
    const appSettings = await db.appSettings.get('global-settings');

    const backupData: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      appName: 'RallyUp',
      players,
      sessions,
      sessionParticipants,
      courts,
      matches,
      appSettings: appSettings || undefined,
    };

    return JSON.stringify(backupData, null, 2);
  },

  /**
   * Import data from JSON string with strict validation
   */
  async importJSON(jsonString: string): Promise<{ success: boolean; message: string; recordCounts?: Record<string, number> }> {
    try {
      const parsed = JSON.parse(jsonString);
      const validated = BackupSchema.parse(parsed);

      await db.transaction(
        'rw',
        [db.players, db.sessions, db.sessionParticipants, db.courts, db.matches, db.appSettings],
        async () => {
          // Clear current tables before restoring
          await db.players.clear();
          await db.sessions.clear();
          await db.sessionParticipants.clear();
          await db.courts.clear();
          await db.matches.clear();

          // Bulk add restored data
          if (validated.players.length > 0) await db.players.bulkAdd(validated.players as Player[]);
          if (validated.sessions.length > 0) await db.sessions.bulkAdd(validated.sessions as Session[]);
          if (validated.sessionParticipants.length > 0) await db.sessionParticipants.bulkAdd(validated.sessionParticipants);
          if (validated.courts.length > 0) await db.courts.bulkAdd(validated.courts);
          if (validated.matches.length > 0) await db.matches.bulkAdd(validated.matches as Match[]);
          if (validated.appSettings) await db.appSettings.put(validated.appSettings);
        }
      );

      return {
        success: true,
        message: 'Backup imported successfully!',
        recordCounts: {
          players: validated.players.length,
          sessions: validated.sessions.length,
          matches: validated.matches.length,
        },
      };
    } catch (err: any) {
      console.error('Import error:', err);
      return {
        success: false,
        message: err.message || 'Invalid backup file format.',
      };
    }
  },

  /**
   * Reset all database tables to clean state
   */
  async resetDatabase(): Promise<void> {
    await db.transaction(
      'rw',
      [db.players, db.sessions, db.sessionParticipants, db.courts, db.matches, db.appSettings],
      async () => {
        await db.players.clear();
        await db.sessions.clear();
        await db.sessionParticipants.clear();
        await db.courts.clear();
        await db.matches.clear();
        await db.appSettings.clear();
      }
    );
  },

  /**
   * Export Players to CSV
   */
  async exportPlayersCSV(): Promise<string> {
    const players = await db.players.toArray();
    const headers = [
      'Player ID',
      'Name',
      'Skill Level',
      'Rating (Est. DUPR)',
      'Email',
      'Phone',
      'Games Played',
      'Wins',
      'Losses',
      'Win %',
      'Points Scored',
      'Points Conceded',
      'Point Diff',
      'Status',
    ];

    const rows = players.map((p) => {
      const gp = p.stats.gamesPlayed || 0;
      const wins = p.stats.wins || 0;
      const winPct = gp > 0 ? ((wins / gp) * 100).toFixed(1) + '%' : '0.0%';
      const scored = p.stats.pointsScored || 0;
      const conceded = p.stats.pointsConceded || 0;
      const diff = scored - conceded;

      return [
        `"${p.id}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${(p.skillLevel || '3.0').replace(/"/g, '""')}"`,
        p.rating !== undefined ? p.rating.toFixed(2) : (p.skillLevel ? p.skillLevel : '3.00'),
        `"${(p.email || '').replace(/"/g, '""')}"`,
        `"${(p.phone || '').replace(/"/g, '""')}"`,
        gp,
        wins,
        p.stats.losses || 0,
        `"${winPct}"`,
        scored,
        conceded,
        diff >= 0 ? `+${diff}` : diff,
        p.isArchived ? '"Archived"' : '"Active"',
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  },

  /**
   * Export Matches to CSV
   */
  async exportMatchesCSV(): Promise<string> {
    const matches = await db.matches.toArray();
    const sessions = await db.sessions.toArray();
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    const headers = [
      'Match ID',
      'Session Name',
      'Date',
      'Court',
      'Round',
      'Format',
      'Scoring Method',
      'Team A',
      'Team B',
      'Score A',
      'Score B',
      'Winner',
      'Status',
    ];

    const rows = matches.map((m) => {
      const session = sessionMap.get(m.sessionId);
      const sessionName = session ? session.name : 'Unknown';
      const sessionDate = session ? session.date : '';
      const teamANames = m.teamA.playerNames.join(' & ');
      const teamBNames = m.teamB.playerNames.join(' & ');
      const winnerName =
        m.winningTeam === 'teamA'
          ? teamANames
          : m.winningTeam === 'teamB'
          ? teamBNames
          : 'None';

      return [
        `"${m.id}"`,
        `"${sessionName.replace(/"/g, '""')}"`,
        `"${sessionDate}"`,
        m.courtNumber,
        m.roundNumber,
        m.matchFormat,
        m.scoringMethod,
        `"${teamANames.replace(/"/g, '""')}"`,
        `"${teamBNames.replace(/"/g, '""')}"`,
        m.scoreA,
        m.scoreB,
        `"${winnerName.replace(/"/g, '""')}"`,
        m.status,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  },

  /**
   * Export Sessions to CSV
   */
  async exportSessionsCSV(): Promise<string> {
    const sessions = await db.sessions.toArray();
    const headers = [
      'Session ID',
      'Session Name',
      'Date',
      'Start Time',
      'Location',
      'Courts',
      'Format',
      'Scoring Format',
      'Target Score',
      'Win Condition',
      'Status',
    ];

    const rows = sessions.map((s) => [
      `"${s.id}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.date}"`,
      `"${s.startTime}"`,
      `"${(s.location || '').replace(/"/g, '""')}"`,
      s.numCourts,
      s.matchFormat,
      s.scoringFormat,
      s.targetScore,
      s.winCondition,
      s.status,
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  },
};
