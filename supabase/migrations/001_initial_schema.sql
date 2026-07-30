-- ============================================================
-- Region HR Client Portal — initial schema
-- ============================================================

-- ---------- Tables ----------

-- Companies table (Region HR's clients)
CREATE TABLE companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document categories
CREATE TABLE document_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

INSERT INTO document_categories (name, icon, color, sort_order) VALUES
  ('Policies', 'shield', '#0c343d', 1),
  ('Payroll Documents', 'dollar-sign', '#f9bf4b', 2),
  ('Procedures & Handbooks', 'book-open', '#3b82f6', 3),
  ('Forms', 'file-text', '#8b5cf6', 4),
  ('Compliance', 'check-square', '#10b981', 5),
  ('Benefits', 'heart', '#ef4444', 6);

-- Documents
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES document_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  is_acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document acknowledgments (who has read what)
CREATE TABLE document_acknowledgments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, user_id)
);

-- Notifications
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Indexes ----------

CREATE INDEX documents_company_id_idx ON documents (company_id);
CREATE INDEX documents_category_id_idx ON documents (category_id);
CREATE INDEX documents_created_at_idx ON documents (created_at DESC);
CREATE INDEX notifications_company_id_idx ON notifications (company_id);
CREATE INDEX profiles_company_id_idx ON profiles (company_id);
CREATE INDEX acknowledgments_user_id_idx ON document_acknowledgments (user_id);

-- ---------- Helper functions ----------
--
-- These are SECURITY DEFINER so they bypass RLS when reading `profiles`.
-- Without them, a policy ON profiles that does `SELECT ... FROM profiles`
-- re-enters its own policy and Postgres raises
-- "infinite recursion detected in policy for relation profiles" (42P17).
-- Every policy below reads the caller's role/company through these.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ---------- Row Level Security ----------

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

-- Document categories: everyone signed in can read
CREATE POLICY "Anyone can read categories" ON document_categories
  FOR SELECT USING (true);

-- Profiles
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- A client must not be able to promote themselves to admin or move companies.
-- "Users can update own profile" would otherwise allow exactly that, so
-- role/company_id changes are rejected at the row level for non-admins.
CREATE OR REPLACE FUNCTION public.guard_profile_privilege_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Only an administrator can change a profile role or company';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_privilege_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privilege_change();

-- Companies
CREATE POLICY "Admins can manage companies" ON companies
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Clients can view their own company" ON companies
  FOR SELECT USING (id = public.current_user_company_id());

-- Documents
CREATE POLICY "Admins can manage all documents" ON documents
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Clients can view their company documents" ON documents
  FOR SELECT USING (company_id = public.current_user_company_id());

-- Acknowledgments
CREATE POLICY "Users can manage own acknowledgments" ON document_acknowledgments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all acknowledgments" ON document_acknowledgments
  FOR SELECT USING (public.is_admin());

-- Notifications
CREATE POLICY "Clients see their notifications" ON notifications
  FOR SELECT USING (company_id = public.current_user_company_id());
CREATE POLICY "Clients can mark their notifications read" ON notifications
  FOR UPDATE USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());
CREATE POLICY "Admins manage all notifications" ON notifications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Triggers ----------

-- Auto-create a profile row whenever an auth user is created.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Keep documents.updated_at honest.
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER documents_touch_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- Storage ----------

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Files live at documents/{company_id}/{filename}, so the first path segment
-- is the owning company. storage.foldername() returns that as element 1.

CREATE POLICY "Admins can read documents bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND public.is_admin());

CREATE POLICY "Admins can upload to documents bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND public.is_admin());

CREATE POLICY "Admins can update documents bucket" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documents' AND public.is_admin());

CREATE POLICY "Admins can delete from documents bucket" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND public.is_admin());

CREATE POLICY "Clients can read their company files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_user_company_id()::TEXT
  );
