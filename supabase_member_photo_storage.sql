-- ============================================================================
-- EDII-MAFBIF: Supabase Storage Configuration for Member Photos
-- Target Bucket: member-photos
-- Security Model:
--   - Public (Anonymous & Authenticated): Read-only access to view profile photos.
--   - Authenticated Verified Admins (in public.admin_users): Upload, Update, Delete.
-- ============================================================================

-- 1. Create or update the 'member-photos' storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'member-photos',
  'member-photos',
  true,
  5242880, -- 5 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Ensure helper function for admin authorization exists
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

-- 3. Row Level Security Policies on storage.objects

-- Allow public read access (Anonymous and Authenticated visitors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view member photos'
  ) THEN
    CREATE POLICY "Public can view member photos"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'member-photos');
  END IF;
END $$;

-- Allow authenticated verified administrators to upload photos (INSERT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can upload member photos'
  ) THEN
    CREATE POLICY "Admins can upload member photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'member-photos' AND public.is_admin()
    );
  END IF;
END $$;

-- Allow authenticated verified administrators to update/replace photos (UPDATE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can update member photos'
  ) THEN
    CREATE POLICY "Admins can update member photos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'member-photos' AND public.is_admin()
    )
    WITH CHECK (
      bucket_id = 'member-photos' AND public.is_admin()
    );
  END IF;
END $$;

-- Allow authenticated verified administrators to delete photos (DELETE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can delete member photos'
  ) THEN
    CREATE POLICY "Admins can delete member photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'member-photos' AND public.is_admin()
    );
  END IF;
END $$;
