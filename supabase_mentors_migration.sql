-- =========================================================================
-- EDII-MAFBIF Mentors Management System — Supabase Database & Storage Migration
-- =========================================================================

-- 1. Ensure public.mentors table exists with correct schema
CREATE TABLE IF NOT EXISTS public.mentors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    designation TEXT,
    institution TEXT,
    specialization TEXT,
    photo_url TEXT,
    display_order INTEGER DEFAULT 999,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;

-- 2. Drop any outdated/redundant policies and ensure clean standard policies
DROP POLICY IF EXISTS "Public can view mentors" ON public.mentors;
DROP POLICY IF EXISTS "Allow public read access on mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can insert mentors" ON public.mentors;
DROP POLICY IF EXISTS "Allow admin insert on mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can update mentors" ON public.mentors;
DROP POLICY IF EXISTS "Allow admin update on mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can delete mentors" ON public.mentors;
DROP POLICY IF EXISTS "Allow admin delete on mentors" ON public.mentors;

-- Read policy for public visitors
CREATE POLICY "Public can view mentors"
ON public.mentors FOR SELECT
TO anon, authenticated
USING (true);

-- Admin write policies checking is_admin() or admin_users
CREATE POLICY "Admins can insert mentors"
ON public.mentors FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
    OR (SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
);

CREATE POLICY "Admins can update mentors"
ON public.mentors FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
    OR (SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
    OR (SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
);

CREATE POLICY "Admins can delete mentors"
ON public.mentors FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
    OR (SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
);

-- 3. Storage bucket: mentor-photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'mentor-photos',
    'mentor-photos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS policies for mentor-photos
DROP POLICY IF EXISTS "Public can view mentor photos" ON storage.objects;
CREATE POLICY "Public can view mentor photos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'mentor-photos');

DROP POLICY IF EXISTS "Admins can upload mentor photos" ON storage.objects;
CREATE POLICY "Admins can upload mentor photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'mentor-photos' AND (
        EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
        OR (SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
    )
);

DROP POLICY IF EXISTS "Admins can update mentor photos" ON storage.objects;
CREATE POLICY "Admins can update mentor photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'mentor-photos' AND (
        EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
        OR (SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
    )
)
WITH CHECK (
    bucket_id = 'mentor-photos' AND (
        EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
        OR (SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
    )
);

DROP POLICY IF EXISTS "Admins can delete mentor photos" ON storage.objects;
CREATE POLICY "Admins can delete mentor photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'mentor-photos' AND (
        EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
        OR (SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false')) = 'true'
    )
);

-- 4. Clean up any dummy test records
DELETE FROM public.mentors WHERE name ILIKE '%Test Mentor%' OR id = 'b4f41276-5ef1-40c7-8f63-359972ce3d4a';

-- 5. Seed / Migrate the 5 verified original mentors from mentors.html
INSERT INTO public.mentors (id, name, designation, institution, specialization, photo_url, display_order)
VALUES
(
    'b0000000-0000-0000-0000-000000000001',
    'Dr. A. Balasubramanian',
    'Dean (Forestry) and Nodal Officer (MAFBIF)',
    'Forest College and Research Institute, Mettupalayam',
    'Agroforestry Leadership & Incubation Nodal Head',
    'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=768,fit=crop/iX3h8rqPfxJk6DDB/dean-photo-ePd3q9KTKLKY1jBp.jpeg',
    1
),
(
    'b0000000-0000-0000-0000-000000000002',
    'Dr. Prasanth Rajan',
    'Asst. Prof',
    'FC&RI Mettupalayam',
    'Essential oils',
    NULL,
    2
),
(
    'b0000000-0000-0000-0000-000000000003',
    'Dr. Umesh Kanna',
    'Assoc. Prof',
    'FC&RI Mettupalayam',
    'Nursery',
    NULL,
    3
),
(
    'b0000000-0000-0000-0000-000000000004',
    'Dr. I. Sekar',
    'Professor',
    'TNAU',
    'Wood seasoning and preservation',
    NULL,
    4
),
(
    'b0000000-0000-0000-0000-000000000005',
    'Dr. Cinthiya Fernandas',
    'Assoc. Prof',
    'FC&RI Mettupalayam',
    'Vermicompost',
    NULL,
    5
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    designation = EXCLUDED.designation,
    institution = EXCLUDED.institution,
    specialization = EXCLUDED.specialization,
    photo_url = COALESCE(public.mentors.photo_url, EXCLUDED.photo_url),
    display_order = EXCLUDED.display_order,
    updated_at = timezone('utc'::text, now());
