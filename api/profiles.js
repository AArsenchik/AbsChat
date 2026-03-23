import { getAuthAddress, getSupabaseAdmin } from './_utils.js'

const json = (res, status, body) => {
  res.status(status).setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
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
    const { data, error } = await supabase
      .from('profiles')
      .select('address, display_name, avatar_url')
      .in('address', addresses)
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
    const { data, error } = await supabase
      .from('profiles')
      .upsert([payload], { onConflict: 'address' })
      .select('address, display_name, avatar_url')
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

