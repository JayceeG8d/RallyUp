import Dexie, { Table } from 'dexie';
import { Player, Session, SessionParticipant, Court, Match, AppSettings } from '@/types';

export class RallyUpDatabase extends Dexie {
  players!: Table<Player, string>;
  sessions!: Table<Session, string>;
  sessionParticipants!: Table<SessionParticipant, string>;
  courts!: Table<Court, string>;
  matches!: Table<Match, string>;
  appSettings!: Table<AppSettings, string>;

  constructor() {
    super('RallyUpDB');

    // Schema version 1
    this.version(1).stores({
      players: 'id, name, isArchived, isGuest, createdAt',
      sessions: 'id, status, date, createdAt',
      sessionParticipants: 'id, sessionId, playerId, status, currentQueueOrder',
      courts: 'id, sessionId, courtNumber, status',
      matches: 'id, sessionId, roundNumber, courtNumber, status, completedAt',
      appSettings: 'id',
    });
  }
}

// Singleton database instance
export const db = new RallyUpDatabase();
