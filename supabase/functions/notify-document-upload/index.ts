// Emails a client company's users when a new document lands in their portal.
//
// Deploy:  supabase functions deploy notify-document-upload
// Secrets: supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=...
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the
//          platform.)
//
// Without RESEND_API_KEY the function is a no-op that reports `skipped`, so the
// portal works end to end before email is wired up.

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'notifications@regionhr.example'
  const portalUrl = Deno.env.get('PORTAL_URL') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Function is not configured.' }, 500)
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Missing authorization header.' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: caller, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !caller?.user) return json({ error: 'Invalid session.' }, 401)

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .maybeSingle()

  if (callerProfile?.role !== 'admin') {
    return json({ error: 'Only administrators can send document notifications.' }, 403)
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const documentId = String(payload.document_id ?? '')
  if (!documentId) return json({ error: 'document_id is required.' }, 400)

  const { data: doc, error: docError } = await admin
    .from('documents')
    .select('id, name, description, company_id, companies (id, name)')
    .eq('id', documentId)
    .maybeSingle()

  if (docError) return json({ error: docError.message }, 500)
  if (!doc) return json({ error: 'Document not found.' }, 404)

  const { data: recipients, error: recipientsError } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('company_id', doc.company_id)
    .not('email', 'is', null)

  if (recipientsError) return json({ error: recipientsError.message }, 500)

  const addresses = (recipients ?? []).map((r) => r.email).filter(Boolean) as string[]
  if (addresses.length === 0) return json({ sent: 0, skipped: 'no recipients' })

  if (!resendKey) {
    return json({ sent: 0, skipped: 'RESEND_API_KEY is not set', recipients: addresses.length })
  }

  const companyName = (doc as { companies?: { name?: string } }).companies?.name ?? 'your company'
  const safeName = escapeHtml(String(doc.name))
  const safeDescription = doc.description ? escapeHtml(String(doc.description)) : ''

  const html = `
    <div style="font-family: 'Source Sans 3', Helvetica, Arial, sans-serif; color:#1a1a2e;">
      <div style="background:#0c343d; padding:24px; text-align:center;">
        <div style="font-family: 'Times New Roman', serif; letter-spacing:0.16em; font-size:22px; color:#f9bf4b;">
          REGION HR
        </div>
        <div style="color:rgba(255,255,255,0.7); font-size:13px;">Workforce Forward.</div>
      </div>
      <div style="padding:24px;">
        <h1 style="font-size:18px; margin:0 0 12px;">A new document is available</h1>
        <p style="margin:0 0 8px;">
          <strong>${safeName}</strong> has been added to the ${escapeHtml(companyName)} portal.
        </p>
        ${safeDescription ? `<p style="margin:0 0 12px; color:#6b7280;">${safeDescription}</p>` : ''}
        ${
          portalUrl
            ? `<p style="margin:20px 0 0;">
                 <a href="${portalUrl}/documents"
                    style="background:#f9bf4b; color:#0c343d; font-weight:700; padding:10px 18px; border-radius:8px; text-decoration:none;">
                   View in the portal
                 </a>
               </p>`
            : '<p style="margin:20px 0 0; color:#6b7280;">Sign in to the Region HR portal to view it.</p>'
        }
      </div>
    </div>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Region HR <${fromEmail}>`,
      // BCC so client users never see each other's addresses.
      to: [fromEmail],
      bcc: addresses,
      subject: `New document available: ${doc.name}`,
      html,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    return json({ error: `Resend rejected the request: ${detail}` }, 502)
  }

  return json({ sent: addresses.length })
})
