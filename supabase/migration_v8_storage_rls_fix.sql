-- ============================================================
-- Database Migration v8 — Storage RLS Policy Fix for exam-images
-- Execute this script in your Supabase SQL Editor to enable image uploads
-- ============================================================

-- 1. Ensure 'exam-images' storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('exam-images', 'exam-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing restrictive policies on storage.objects for exam-images
DROP POLICY IF EXISTS "Public Storage Access" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage objects" ON storage.objects;
DROP POLICY IF EXISTS "Give public full access to exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update in exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from exam-images" ON storage.objects;

-- 3. Create permissive policy allowing full access (SELECT, INSERT, UPDATE, DELETE) for exam-images bucket
CREATE POLICY "Give public full access to exam-images" ON storage.objects
  FOR ALL
  TO public, anon, authenticated
  USING (bucket_id = 'exam-images')
  WITH CHECK (bucket_id = 'exam-images');
