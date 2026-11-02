-- ============================================================================
-- RALLYUP PICKLEBALL OPEN PLAY MANAGER
-- SUPABASE POSTGRESQL + REALTIME WEBSOCKETS SCHEMA
-- Paste and run this script in your Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Players Table
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 2. Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 3. Session Participants Table
CREATE TABLE IF NOT EXISTS public.session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 4. Courts Table
CREATE TABLE IF NOT EXISTS public.courts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 5. Matches Table
CREATE TABLE IF NOT EXISTS public.matches (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_participants_session ON public.session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_courts_session ON public.courts(session_id);
CREATE INDEX IF NOT EXISTS idx_matches_session ON public.matches(session_id);

-- Enable Row Level Security (RLS) with open policies for instant multi-device sync
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Allow public access players') THEN
    CREATE POLICY "Allow public access players" ON public.players FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Allow public access sessions') THEN
    CREATE POLICY "Allow public access sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_participants' AND policyname = 'Allow public access session_participants') THEN
    CREATE POLICY "Allow public access session_participants" ON public.session_participants FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'courts' AND policyname = 'Allow public access courts') THEN
    CREATE POLICY "Allow public access courts" ON public.courts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Allow public access matches') THEN
    CREATE POLICY "Allow public access matches" ON public.matches FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Enable Supabase Realtime WebSockets on all 5 tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.courts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
