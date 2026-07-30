// Creates a portal user with Supabase's admin API.
//
// This lives server-side on purpose. supabase.auth.admin.createUser() needs the
// service-role key, which bypasses every RLS policy — shipping it in a static
// Vite bundle would hand full database access to anyone who opens devtools.
// The function verifies the *caller's* JWT belongs to an admin before acting.
//
// Deploy:  supabase functions deploy admin-create-user
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (set automatically by the
//          Supabase platform for deployed functions).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Function is not configured.' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Missing authorization header.' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Who is calling?
  const { data: caller, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !caller?.user) return json({ error: 'Invalid session.' }, 401)

  // 2. Are they an admin? Checked against the database, never against anything
  //    the client sent us.
  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .maybeSingle()

  if (profileError) return json({ error: profileError.message }, 500)
  if (callerProfile?.role !== 'admin') {
    return json({ error: 'Only administrators can create users.' }, 403)
  }

  // 3. Validate the payload.
  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const email = String(payload.email ?? '').trim()
  const password = String(payload.password ?? '')
  const fullName = String(payload.full_name ?? '').trim()
  const role = String(payload.role ?? 'client')
  const companyId = payload.company_id ? String(payload.company_id) : null

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'A valid email address is required.' }, 400)
  }
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, 400)
  }
  if (role !== 'admin' && role !== 'client') {
    return json({ error: 'Role must be admin or client.' }, 400)
  }
  if (role === 'client' && !companyId) {
    return json({ error: 'Client accounts must belong to a company.' }, 400)
  }

  // 4. Create the auth user. The handle_new_user() trigger reads this metadata
  //    to populate the matching profiles row.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      company_id: companyId ?? '',
    },
  })

  if (createError) return json({ error: createError.message }, 400)

  // 5. Belt and braces: make sure the profile matches what was requested even
  //    if the trigger is missing or an older version is deployed.
  const { error: upsertError } = await admin
    .from('profiles')
    .upsert(
      {
        id: created.user.id,
        email,
        full_name: fullName || null,
        role,
        company_id: companyId,
      },
      { onConflict: 'id' }
    )

  if (upsertError) return json({ error: upsertError.message }, 500)

  return json({ id: created.user.id, email, role, company_id: companyId })
})
