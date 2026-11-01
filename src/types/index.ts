export type MatchFormat = 'doubles' | 'singles';
export type ScoringFormat = 'sideout' | 'rally';
export type WinCondition = 'win_by_1' | 'win_by_2';
export type RotationMode = 'fair' | 'random' | 'partner';

export type CourtStatus = 'available' | 'playing' | 'completed' | 'maintenance';
export type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'abandoned';
export type ParticipantStatus = 'waiting' | 'playing' | 'benched' | 'checked_out';

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsScored: number;
  pointsConceded: number;
}

export interface Player {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  avatarColor?: string; // hex color for avatar badge
  photoUrl?: string; // base64 data URL for profile picture
  skillLevel?: string; // e.g. "Newbie / 2.0", "2.5", "3.0", "3.5", etc.
  initialSkillLevel?: string;
  rating?: number; // Dynamic Performance Rating (starts at skillLevel, updates after matches)
  isGuest?: boolean;
  isArchived?: boolean; // soft delete to maintain historical match integrity
  createdAt: number;
  updatedAt: number;
  stats: PlayerStats;
}

export interface Session {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  location?: string;
  numCourts: number;
  matchFormat: MatchFormat;
  targetScore: number;
  winCondition: WinCondition;
  scoringFormat: ScoringFormat;
  rotationMode: RotationMode;
  notes?: string;
  status: 'setup' | 'active' | 'completed';
  currentRound: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  isGuest?: boolean;
  joinedAt: number;
  status: ParticipantStatus;
  currentQueueOrder: number; // For fair queue ordering
  waitingSince?: number; // timestamp
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsScored: number;
  pointsConceded: number;
  lastCourtNumber?: number;
}

export interface Court {
  id: string;
  sessionId: string;
  courtNumber: number;
  courtName: string;
  status: CourtStatus;
  currentMatchId?: string;
}

export interface LiveScoringSnapshot {
  scoreA: number;
  scoreB: number;
  servingTeam: 'teamA' | 'teamB';
  serverNumber: 1 | 2; // For doubles sideout (1 = first server, 2 = second server)
  servingSide: 'right' | 'left'; // Right = even, Left = odd
  servingPlayerIndex: number; // 0 or 1 in team array
  scoreCall: string; // e.g. "4 - 2 - 1"
  timestamp: number;
  actionDescription: string;
}

export interface Match {
  id: string;
  sessionId: string;
  roundNumber: number;
  courtNumber: number;
  matchFormat: MatchFormat;
  scoringMethod: 'live' | 'manual';
  scoringFormat: ScoringFormat;
  targetScore: number;
  winCondition: WinCondition;
  teamA: {
    playerIds: string[];
    playerNames: string[];
  };
  teamB: {
    playerIds: string[];
    playerNames: string[];
  };
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  winningTeam: 'teamA' | 'teamB' | null;
  liveState?: {
    servingTeam: 'teamA' | 'teamB';
    serverNumber: 1 | 2;
    servingSide: 'right' | 'left';
    servingPlayerIndex: number;
    scoreCall: string;
    history: LiveScoringSnapshot[];
  };
  overrideReason?: string;
  isOverrideWin?: boolean;
  startedAt?: number;
  completedAt?: number;
  notes?: string;
}

export interface AppSettings {
  id: string;
  theme: 'dark' | 'light';
  soundEnabled: boolean;
  defaultNumCourts: number;
  defaultTargetScore: number;
  defaultWinCondition: WinCondition;
  defaultScoringFormat: ScoringFormat;
  defaultMatchFormat: MatchFormat;
  defaultRotationMode: RotationMode;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  appName: string;
  players: Player[];
  sessions: Session[];
  sessionParticipants: SessionParticipant[];
  courts: Court[];
  matches: Match[];
  appSettings?: AppSettings;
}
