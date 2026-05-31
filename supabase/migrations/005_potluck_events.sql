-- ============================================================
-- MIGRATION 005: potluck_events + new potluck_items schema
-- Run in Supabase Dashboard → SQL Editor
--
-- The app (PotluckPage.jsx) uses potluck_events + potluck_items.
-- The old schema had potluck_items tied to household_id with a
-- separate potluck_claims table. This migration adds the new
-- event-based structure while preserving the old table.
-- ============================================================

-- 1. Create potluck_events table
CREATE TABLE IF NOT EXISTS public.potluck_events (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  event_code  text        NOT NULL UNIQUE,
  event_date  date,
  event_time  time,
  venue       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Re-create potluck_items to reference event_id instead of household_id
--    We keep the old table intact so no existing data is lost.
--    If you want to drop it later: DROP TABLE public.potluck_items CASCADE;
CREATE TABLE IF NOT EXISTS public.potluck_items (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        uuid        NOT NULL REFERENCES public.potluck_events(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  claimed_by_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.potluck_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.potluck_items  ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for potluck_events
--    Any authenticated user can view, create, and manage their own events.
DROP POLICY IF EXISTS "pe: authenticated can view"  ON public.potluck_events;
DROP POLICY IF EXISTS "pe: authenticated can create" ON public.potluck_events;
DROP POLICY IF EXISTS "pe: host can update"         ON public.potluck_events;
DROP POLICY IF EXISTS "pe: host can delete"         ON public.potluck_events;

CREATE POLICY "pe: authenticated can view"
  ON public.potluck_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "pe: authenticated can create"
  ON public.potluck_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND host_id = auth.uid());

CREATE POLICY "pe: host can update"
  ON public.potluck_events FOR UPDATE
  USING (host_id = auth.uid());

CREATE POLICY "pe: host can delete"
  ON public.potluck_events FOR DELETE
  USING (host_id = auth.uid());

-- 5. RLS policies for potluck_items
--    Any authenticated user can view and manage items on any event.
DROP POLICY IF EXISTS "pi2: authenticated manages" ON public.potluck_items;

CREATE POLICY "pi2: authenticated manages"
  ON public.potluck_items FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Enable real-time for these tables
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.potluck_events; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.potluck_items;  EXCEPTION WHEN others THEN NULL; END;
END $$;
