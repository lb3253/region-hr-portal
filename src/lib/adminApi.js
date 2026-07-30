import { supabase } from './supabase'

/**
 * supabase-js raises FunctionsFetchError ("Failed to send a request to the Edge
 * Function") whenever the fetch itself fails, which covers a function that was
 * never deployed, a name mismatch, and a preflight blocked by the platform's
 * JWT check alike.
 */
function isUnreachable(error) {
  return (
    error?.name === 'FunctionsFetchError' ||
    /failed to (send|fetch)/i.test(error?.message || '')
  )
}

/**
 * Creating a user requires Supabase's service-role key, which grants full
 * unrestricted access to the database. This portal is a static site — anything
 * it holds ships to the browser — so the key lives only in the
 * `admin-create-user` Edge Function, which re-checks that the caller really is
 * an admin before calling supabase.auth.admin.createUser().
 *
 * See supabase/functions/admin-create-user/index.ts.
 */
export async function createPortalUser({ email, password, fullName, role, companyId }) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: {
      email,
      password,
      full_name: fullName,
      role,
      company_id: companyId || null,
    },
  })

  if (error) {
    // Edge functions return the useful message in the response body.
    let detail = ''
    try {
      detail = (await error.context?.json())?.error || ''
    } catch {
      detail = ''
    }
    if (detail) throw new Error(detail)

    // No body at all means the browser never got a usable response — the
    // function is missing, misnamed, or its CORS preflight was rejected before
    // it ran. supabase-js reports all of those as the same opaque message, so
    // point at the things worth checking instead of repeating it.
    if (isUnreachable(error)) {
      throw new Error(
        'Could not reach the admin-create-user function. Check that it is deployed ' +
          'under exactly that name and that its "Verify JWT" setting is turned off ' +
          '(the function checks the caller itself), then try again.'
      )
    }

    throw new Error(error.message || 'Could not create the user.')
  }

  if (data?.error) throw new Error(data.error)
  return data
}

/**
 * Fires the Resend-backed notification email for a freshly uploaded document.
 * Best-effort: the upload itself already succeeded by the time this runs, so
 * callers surface a warning rather than treating a failure as fatal.
 */
export async function sendUploadNotification({ documentId }) {
  const { data, error } = await supabase.functions.invoke('notify-document-upload', {
    body: { document_id: documentId },
  })
  if (error) throw error
  return data
}
