# Region HR — Client Portal

A multi-tenant client portal for **Region HR**. Client companies sign in to see
their own HR and payroll documents instead of receiving them over email; Region
HR staff sign in as admins to manage companies, users and uploads.

React 18 + Vite · Supabase (auth, Postgres, storage) · React Router 6 ·
plain CSS with variables · static build for Cloudflare Pages.

---

## Quick start

```bash
npm install
cp .env.example .env      # fill in your Supabase URL and anon key
npm run dev               # http://localhost:5173
```

`npm run build` emits a static `dist/`; `npm run preview` serves it locally.

---

## Supabase setup

1. **Schema** — run `supabase/migrations/001_initial_schema.sql` against your
   project (`supabase db push`, or paste it into the SQL editor). It creates the
   tables, the six default document categories, all RLS policies, the
   `documents` storage bucket and its policies, and the trigger that creates a
   `profiles` row for every new auth user.

2. **Edge functions** — the portal needs two:

   ```bash
   supabase functions deploy admin-create-user
   supabase functions deploy notify-document-upload
   supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=... PORTAL_URL=https://portal.example.com
   ```

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform —
   you do not set those yourself.

3. **First admin** — there is no public sign-up, and creating users requires an
   existing admin, so bootstrap the first one by hand. Create the user in
   Authentication → Users, then in the SQL editor:

   ```sql
   UPDATE profiles SET role = 'admin', full_name = 'Your Name'
   WHERE email = 'you@regionhr.com';
   ```

   From then on, everything happens through **Admin → Users**.

---

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | build / browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | build / browser | Public anon key — safe to ship, RLS constrains it |
| `RESEND_API_KEY` | edge function secret | Email notifications |
| `RESEND_FROM_EMAIL` | edge function secret | Verified Resend sender |
| `PORTAL_URL` | edge function secret | Used for the "View in the portal" link |
| `SUPABASE_SERVICE_ROLE_KEY` | edge function (auto) | Admin API — **never** give this a `VITE_` prefix |

Anything prefixed `VITE_` is inlined into the JavaScript bundle and is public.
The service-role key bypasses every RLS policy, so it must stay server-side.

---

## Deploying to Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

`public/_redirects` contains the SPA fallback (`/* /index.html 200`) so deep
links like `/admin/documents` resolve on a hard refresh.

---

## How access control works

Every table has RLS enabled, and the browser only ever holds the anon key —
authorization is enforced by Postgres, not by the UI.

- **Clients** read only rows whose `company_id` matches their profile, and can
  only read storage objects under `documents/{their_company_id}/`.
- **Admins** read and write everything.
- Route guards (`ProtectedRoute`) mirror these rules for navigation, but they
  are a convenience — the database is the real boundary.

Documents live in a **private** bucket. Viewing one mints a signed URL that
expires after an hour (`createSignedUrl(path, 3600)`); no file is ever served
from a public URL.

### Three deviations from the original spec

1. **`profiles` policies use `SECURITY DEFINER` helpers.** The specified
   policies read `profiles` from inside a policy *on* `profiles`, which makes
   Postgres raise `infinite recursion detected in policy for relation
   "profiles"` (42P17) on the first query — the portal cannot load at all.
   `public.is_admin()` and `public.current_user_company_id()` do the same reads
   outside RLS, so the semantics are unchanged and the recursion is gone.

2. **User creation runs in an edge function.** `supabase.auth.admin.createUser()`
   requires the service-role key. This is a static site, so calling it from the
   browser would publish that key to every visitor and hand them unrestricted
   database access. `admin-create-user` holds the key server-side and re-checks
   that the caller is an admin before creating anything.

3. **A trigger guards privilege changes.** "Users can update own profile" as
   written also lets a client set their own `role` to `'admin'` or point
   `company_id` at another company's data. `guard_profile_privilege_change()`
   rejects those two columns changing unless an admin is making the change.

---

## Project layout

```
src/
├── components/
│   ├── layout/      Layout, Sidebar
│   ├── ui/          Button, Modal, Badge, FileIcon, EmptyState, Icon, Spinner
│   ├── documents/   DocumentCard, CategoryTabs
│   └── routing/     ProtectedRoute
├── pages/           Login, Dashboard, Documents, Notifications, Profile
│   └── admin/       AdminDashboard, Companies, Users, Upload, DocumentManager
├── hooks/           useAuth, useDocuments, useNotifications
├── context/         AuthContext, NotificationsContext, ToastContext
├── lib/             supabase, adminApi, format
└── styles/          globals.css
supabase/
├── migrations/      001_initial_schema.sql
└── functions/       admin-create-user, notify-document-upload
```

Icons are inline SVG (`components/ui/Icon.jsx`) — no icon library.
