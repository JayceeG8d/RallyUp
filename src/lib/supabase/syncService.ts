import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { db } from '../db/dexie';
import { Player, Session, SessionParticipant, Court, Match } from '@/types';

let activeChannel: RealtimeChannel | null = null;

export const SUPABASE_SCHEMA_SQL = `-- RALLYUP SUPABASE POSTGRESQL + REALTIME WEBSOCKETS SCHEMA
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS public.session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS public.courts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS public.matches (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access players" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access session_participants" ON public.session_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access courts" ON public.courts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access matches" ON public.matches FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.courts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;`;

export const SupabaseSync = {
  // --- NON-BLOCKING BACKGROUND UPSERTS ---
  async syncPlayer(player: Player): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('players').upsert({
        id: player.id,
        data: player,
        updated_at: player.updatedAt || Date.now(),
      });
    } catch (err) {
      console.warn('Supabase syncPlayer warning:', err);
    }
  },

  async deletePlayer(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('players').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deletePlayer warning:', err);
    }
  },

  async syncSession(session: Session): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('sessions').upsert({
        id: session.id,
        data: session,
        updated_at: Date.now(),
      });
    } catch (err) {
      console.warn('Supabase syncSession warning:', err);
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await Promise.all([
        supabase.from('sessions').delete().eq('id', sessionId),
        supabase.from('courts').delete().eq('session_id', sessionId),
        supabase.from('session_participants').delete().eq('session_id', sessionId),
        supabase.from('matches').delete().eq('session_id', sessionId),
      ]);
    } catch (err) {
      console.warn('Supabase deleteSession warning:', err);
    }
  },

  async syncCourts(courts: Court[]): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase || courts.length === 0) return;
    try {
      const now = Date.now();
      await supabase.from('courts').upsert(
        courts.map((c) => ({
          id: c.id,
          session_id: c.sessionId,
          data: c,
          updated_at: now,
        }))
      );
    } catch (err) {
      console.warn('Supabase syncCourts warning:', err);
    }
  },

  async syncParticipants(participants: SessionParticipant[]): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase || participants.length === 0) return;
    try {
      const now = Date.now();
      await supabase.from('session_participants').upsert(
        participants.map((p) => ({
          id: p.id,
          session_id: p.sessionId,
          data: p,
          updated_at: now,
        }))
      );
    } catch (err) {
      console.warn('Supabase syncParticipants warning:', err);
    }
  },

  async syncMatches(matches: Match[]): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase || matches.length === 0) return;
    try {
      const now = Date.now();
      await supabase.from('matches').upsert(
        matches.map((m) => ({
          id: m.id,
          session_id: m.sessionId,
          data: m,
          updated_at: now,
        }))
      );
    } catch (err) {
      console.warn('Supabase syncMatches warning:', err);
    }
  },

  async syncFullSessionState(sessionId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const [session, courts, participants, matches] = await Promise.all([
        db.sessions.get(sessionId),
        db.courts.where('sessionId').equals(sessionId).toArray(),
        db.sessionParticipants.where('sessionId').equals(sessionId).toArray(),
        db.matches.where('sessionId').equals(sessionId).toArray(),
      ]);
      await Promise.all([
        session ? this.syncSession(session) : Promise.resolve(),
        this.syncCourts(courts),
        this.syncParticipants(participants),
        this.syncMatches(matches),
      ]);
    } catch (err) {
      console.warn('Supabase syncFullSessionState warning:', err);
    }
  },

  // --- FULL PUSH & PULL ---
  async pushAllToCloud(): Promise<{
    success: boolean;
    message: string;
    counts?: { players: number; sessions: number; matches: number };
  }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Supabase is not configured yet.' };
    }

    try {
      const [players, sessions, participants, courts, matches] = await Promise.all([
        db.players.toArray(),
        db.sessions.toArray(),
        db.sessionParticipants.toArray(),
        db.courts.toArray(),
        db.matches.toArray(),
      ]);

      const now = Date.now();

      if (players.length > 0) {
        const { error } = await supabase.from('players').upsert(
          players.map((p) => ({ id: p.id, data: p, updated_at: p.updatedAt || now }))
        );
        if (error) throw new Error(`Players table error: ${error.message}`);
      }

      if (sessions.length > 0) {
        const { error } = await supabase.from('sessions').upsert(
          sessions.map((s) => ({ id: s.id, data: s, updated_at: now }))
        );
        if (error) throw new Error(`Sessions table error: ${error.message}`);
      }

      if (participants.length > 0) {
        const { error } = await supabase.from('session_participants').upsert(
          participants.map((p) => ({ id: p.id, session_id: p.sessionId, data: p, updated_at: now }))
        );
        if (error) throw new Error(`Participants table error: ${error.message}`);
      }

      if (courts.length > 0) {
        const { error } = await supabase.from('courts').upsert(
          courts.map((c) => ({ id: c.id, session_id: c.sessionId, data: c, updated_at: now }))
        );
        if (error) throw new Error(`Courts table error: ${error.message}`);
      }

      if (matches.length > 0) {
        const { error } = await supabase.from('matches').upsert(
          matches.map((m) => ({ id: m.id, session_id: m.sessionId, data: m, updated_at: now }))
        );
        if (error) throw new Error(`Matches table error: ${error.message}`);
      }

      return {
        success: true,
        message: `Synced ${players.length} players, ${sessions.length} sessions, and ${matches.length} matches to Supabase PostgreSQL!`,
        counts: { players: players.length, sessions: sessions.length, matches: matches.length },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to push data to Supabase. Make sure you ran the SQL Schema in Supabase SQL Editor.',
      };
    }
  },

  async pullAllFromCloud(): Promise<{
    success: boolean;
    message: string;
    counts?: { players: number; sessions: number; matches: number };
  }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Supabase is not configured yet.' };
    }

    try {
      const [playersRes, sessionsRes, participantsRes, courtsRes, matchesRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('sessions').select('*'),
        supabase.from('session_participants').select('*'),
        supabase.from('courts').select('*'),
        supabase.from('matches').select('*'),
      ]);

      if (playersRes.error) throw new Error(`Players query error: ${playersRes.error.message}`);
      if (sessionsRes.error) throw new Error(`Sessions query error: ${sessionsRes.error.message}`);

      const players: Player[] = (playersRes.data || []).map((r: any) => r.data);
      const sessions: Session[] = (sessionsRes.data || []).map((r: any) => r.data);
      const participants: SessionParticipant[] = (participantsRes.data || []).map((r: any) => r.data);
      const courts: Court[] = (courtsRes.data || []).map((r: any) => r.data);
      const matches: Match[] = (matchesRes.data || []).map((r: any) => r.data);

      await db.transaction(
        'rw',
        [db.players, db.sessions, db.sessionParticipants, db.courts, db.matches],
        async () => {
          if (players.length > 0) await db.players.bulkPut(players);
          if (sessions.length > 0) await db.sessions.bulkPut(sessions);
          if (participants.length > 0) await db.sessionParticipants.bulkPut(participants);
          if (courts.length > 0) await db.courts.bulkPut(courts);
          if (matches.length > 0) await db.matches.bulkPut(matches);
        }
      );

      return {
        success: true,
        message: `Pulled ${players.length} players, ${sessions.length} sessions, and ${matches.length} matches from Supabase!`,
        counts: { players: players.length, sessions: sessions.length, matches: matches.length },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to pull data from Supabase.',
      };
    }
  },

  // --- REALTIME WEBSOCKETS SUBSCRIPTION ---
  subscribeToRealtime(onDataUpdated: () => void): () => void {
    if (!isSupabaseConfigured()) return () => {};
    const supabase = getSupabaseClient();
    if (!supabase) return () => {};

    if (activeChannel) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }

    const channel = supabase
      .channel('rallyup-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        async (payload) => {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            await db.players.delete(payload.old.id);
          } else if (payload.new && (payload.new as any).data) {
            await db.players.put((payload.new as any).data);
          }
          onDataUpdated();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        async (payload) => {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            await db.sessions.delete(payload.old.id);
          } else if (payload.new && (payload.new as any).data) {
            await db.sessions.put((payload.new as any).data);
          }
          onDataUpdated();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_participants' },
        async (payload) => {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            await db.sessionParticipants.delete(payload.old.id);
          } else if (payload.new && (payload.new as any).data) {
            await db.sessionParticipants.put((payload.new as any).data);
          }
          onDataUpdated();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'courts' },
        async (payload) => {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            await db.courts.delete(payload.old.id);
          } else if (payload.new && (payload.new as any).data) {
            await db.courts.put((payload.new as any).data);
          }
          onDataUpdated();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        async (payload) => {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            await db.matches.delete(payload.old.id);
          } else if (payload.new && (payload.new as any).data) {
            await db.matches.put((payload.new as any).data);
          }
          onDataUpdated();
        }
      )
      .subscribe();

    activeChannel = channel;

    return () => {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
    };
  },
};
