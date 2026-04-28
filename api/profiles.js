import { getAuthAddress, getSupabaseAdmin } from './_utils.js'

const json = (res, status, body) => {
  res.status(status).setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const isMissingBioColumnError = (error) => {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    message.includes("could not find the 'bio' column") ||
    message.includes('column profiles.bio does not exist') ||
    message.includes('schema cache')
  )
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    json(res, 500, { error: 'Supabase admin not configured' })
    return
  }
  const user = getAuthAddress(req)
  if (!user) {
    json(res, 401, { error: 'Unauthorized' })
    return
  }

  if (req.method === 'GET') {
    const raw = typeof req.query?.addresses === 'string' ? req.query.addresses : ''
    const addresses = raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
    if (addresses.length === 0) {
      json(res, 200, { data: [] })
      return
    }
    let { data, error } = await supabase
      .from('profiles')
      .select('address, display_name, avatar_url, bio')
      .in('address', addresses)
    if (error && isMissingBioColumnError(error)) {
      const fallback = await supabase
        .from('profiles')
        .select('address, display_name, avatar_url')
        .in('address', addresses)
      data = fallback.data
      error = fallback.error
    }
    if (error) {
      json(res, 500, { error: error.message })
      return
    }
    json(res, 200, { data: data ?? [] })
    return
  }

  if (req.method === 'POST') {
    const payload = req.body || {}
    const address = String(payload.address ?? '').toLowerCase()
    if (!address || address !== user) {
      json(res, 403, { error: 'Forbidden' })
      return
    }
    const displayNameRaw =
      typeof payload.display_name === 'string' ? payload.display_name.trim() : ''
    const displayName = displayNameRaw ? displayNameRaw : null
    const bioRaw = typeof payload.bio === 'string' ? payload.bio.trim() : ''
    const bio = bioRaw ? bioRaw.slice(0, 67) : null
    if (displayName && displayName.length < 3) {
      json(res, 400, { error: 'Username must be at least 3 characters' })
      return
    }
    if (displayName) {
      const { data: duplicateRows, error: duplicateError } = await supabase
        .from('profiles')
        .select('address')
        .ilike('display_name', displayName)
        .neq('address', address)
        .limit(1)
      if (duplicateError) {
        json(res, 500, { error: duplicateError.message })
        return
      }
      if (Array.isArray(duplicateRows) && duplicateRows.length > 0) {
        json(res, 409, { error: 'Username is already taken' })
        return
      }
    }
    const baseUpsertPayload = {
      address,
      display_name: displayName,
      avatar_url: typeof payload.avatar_url === 'string' ? payload.avatar_url : null,
      updated_at:
        typeof payload.updated_at === 'string'
          ? payload.updated_at
          : new Date().toISOString(),
    }
    let { data, error } = await supabase
      .from('profiles')
      .upsert([{ ...baseUpsertPayload, bio }], { onConflict: 'address' })
      .select('address, display_name, avatar_url, bio')
    if (error && isMissingBioColumnError(error)) {
      const fallback = await supabase
        .from('profiles')
        .upsert([baseUpsertPayload], { onConflict: 'address' })
        .select('address, display_name, avatar_url')
      data = fallback.data
      error = fallback.error
    }
    if (error) {
      json(res, 500, { error: error.message })
      return
    }
    const row = Array.isArray(data) ? data[0] : null
    json(res, 200, { data: row ?? null })
    return
  }

  res.status(405).end()
}
