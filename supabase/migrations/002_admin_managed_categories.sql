-- ============================================================
-- Let admins manage document categories from the portal.
--
-- 001 gave document_categories a read policy only, so with RLS enabled an
-- INSERT from an admin was rejected ("new row violates row-level security
-- policy"). These policies close that gap; clients keep read-only access.
-- ============================================================

CREATE POLICY "Admins can insert categories" ON document_categories
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories" ON document_categories
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete categories" ON document_categories
  FOR DELETE USING (public.is_admin());

-- Deleting a category that documents still reference would fail on the foreign
-- key. Uncategorizing those documents is the friendlier outcome — the admin UI
-- warns how many are affected before the delete goes through.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_category_id_fkey;

ALTER TABLE documents
  ADD CONSTRAINT documents_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES document_categories(id) ON DELETE SET NULL;
