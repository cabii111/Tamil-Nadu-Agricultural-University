-- ============================================================================
-- EDII-MAFBIF: Supabase Database Permissions & Row Level Security (RLS) Fix
-- Target Tables: public.admin_users, public.members, public.mentors
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table-Level Grants (Fixes PostgreSQL 42501 "permission denied for table")
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Public / Anonymous Role: Read-only access for website display
GRANT SELECT ON TABLE public.members TO anon;
GRANT SELECT ON TABLE public.mentors TO anon;

-- Authenticated Role: Full CRUD access for administrator operations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mentors TO authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Ensure Row Level Security is Enabled
-- ----------------------------------------------------------------------------
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. Cleanup Legacy or Conflicting Policies (Prevents duplicate policy errors)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access on members" ON public.members;
DROP POLICY IF EXISTS "Allow admin insert on members" ON public.members;
DROP POLICY IF EXISTS "Allow admin update on members" ON public.members;
DROP POLICY IF EXISTS "Allow admin delete on members" ON public.members;
DROP POLICY IF EXISTS "Allow admin full access on members" ON public.members;
DROP POLICY IF EXISTS "Public members are viewable by everyone" ON public.members;

DROP POLICY IF EXISTS "Allow public read access on mentors" ON public.mentors;
DROP POLICY IF EXISTS "Allow admin insert on mentors" ON public.mentors;
DROP POLICY IF EXISTS "Allow admin update on mentors" ON public.mentors;
DROP POLICY IF EXISTS "Allow admin delete on mentors" ON public.mentors;
DROP POLICY IF EXISTS "Allow admin full access on mentors" ON public.mentors;
DROP POLICY IF EXISTS "Public mentors are viewable by everyone" ON public.mentors;

DROP POLICY IF EXISTS "Allow authenticated users to read admin_users" ON public.admin_users;

-- ----------------------------------------------------------------------------
-- 4. Policies for public.admin_users
-- ----------------------------------------------------------------------------
-- Authenticated users can check whether their user_id is in admin_users
CREATE POLICY "Allow authenticated users to read admin_users"
ON public.admin_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. Policies for public.members
-- ----------------------------------------------------------------------------
-- Public visitors and admins can read members
CREATE POLICY "Allow public read access on members"
ON public.members
FOR SELECT
USING (true);

-- Only verified administrators in admin_users can insert new members
CREATE POLICY "Allow admin insert on members"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Only verified administrators in admin_users can update members
CREATE POLICY "Allow admin update on members"
ON public.members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Only verified administrators in admin_users can delete members
CREATE POLICY "Allow admin delete on members"
ON public.members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 6. Policies for public.mentors
-- ----------------------------------------------------------------------------
-- Public visitors and admins can read mentors
CREATE POLICY "Allow public read access on mentors"
ON public.mentors
FOR SELECT
USING (true);

-- Only verified administrators in admin_users can insert new mentors
CREATE POLICY "Allow admin insert on mentors"
ON public.mentors
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Only verified administrators in admin_users can update mentors
CREATE POLICY "Allow admin update on mentors"
ON public.mentors
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Only verified administrators in admin_users can delete mentors
CREATE POLICY "Allow admin delete on mentors"
ON public.mentors
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);
