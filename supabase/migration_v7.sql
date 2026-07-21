-- ============================================================
-- Database Migration v7 — Search and Performance Indexes
-- ============================================================

-- 1. Indexes on violations table to speed up kick-history and proctor alerts
CREATE INDEX IF NOT EXISTS idx_violations_attempt_id ON public.violations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_violations_student_id ON public.violations(student_id);

-- 2. Indexes on kick_logs table to speed up history retrieval
CREATE INDEX IF NOT EXISTS idx_kick_logs_attempt_id ON public.kick_logs(attempt_id);
CREATE INDEX IF NOT EXISTS idx_kick_logs_student_id ON public.kick_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_kick_logs_exam_id ON public.kick_logs(exam_id);

-- 3. Indexes on profiles role to speed up student stats count queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. Indexes on exams to speed up active listings and ordering
CREATE INDEX IF NOT EXISTS idx_exams_is_published ON public.exams(is_published);
CREATE INDEX IF NOT EXISTS idx_exams_created_at_desc ON public.exams(created_at DESC);
