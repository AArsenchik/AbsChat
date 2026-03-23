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
    const chainId = Number(req.query?.chainId ?? 0)
    let query = supabase
      .from('secret_visibility')
      .select('peer_address, hidden, updated_at, chain_id, owner_address')
      .eq('owner_address', user)
    if (chainId) query = query.eq('chain_id', chainId)
    const { data, error } = await query
    if (error) {
      json(res, 500, { error: error.message })
      return
    }
    json(res, 200, { data: data ?? [] })
    return
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const { peer_address, hidden, updated_at, chain_id } = req.body || {}
    const peer = String(peer_address ?? '').toLowerCase()
    if (!peer) {
      json(res, 400, { error: 'Missing peer_address' })
      return
    }
    const payload = {
      owner_address: user,
      peer_address: peer,
      hidden: Boolean(hidden),
      updated_at: updated_at || new Date().toISOString(),
      chain_id: Number(chain_id),
    }
    const { data, error } = await supabase
      .from('secret_visibility')
      .upsert([payload], { onConflict: 'owner_address,peer_address,chain_id' })
      .select('peer_address, hidden, updated_at, chain_id, owner_address')
    if (error) {
      json(res, 500, { error: error.message })
      return
    }
    json(res, 200, { data: Array.isArray(data) ? data[0] : null })
    return
  }

  res.status(405).end()
}

