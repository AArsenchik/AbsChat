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
      .from('secret_chats')
      .select('address_a, address_b, created_at, chain_id')
      .or(`address_a.eq.${user},address_b.eq.${user}`)
    if (chainId) query = query.eq('chain_id', chainId)
    const { data, error } = await query
    if (error) {
      json(res, 500, { error: error.message })
      return
    }
    json(res, 200, { data: data ?? [] })
    return
  }

  if (req.method === 'POST') {
    const { peer, chain_id, created_at } = req.body || {}
    const peerLower = String(peer ?? '').toLowerCase()
    if (!peerLower) {
      json(res, 400, { error: 'Missing peer' })
      return
    }
    const [addressA, addressB] = [user, peerLower].sort()
    const payload = {
      address_a: addressA,
      address_b: addressB,
      chain_id: Number(chain_id),
      created_at: created_at || new Date().toISOString(),
      created_by: user,
    }
    const { data, error } = await supabase
      .from('secret_chats')
      .upsert([payload], { onConflict: 'address_a,address_b,chain_id' })
      .select('address_a, address_b, created_at, chain_id')
    if (error) {
      json(res, 500, { error: error.message })
      return
    }
    json(res, 200, { data: Array.isArray(data) ? data[0] : null })
    return
  }

  if (req.method === 'DELETE') {
    const peer = typeof req.query?.peer === 'string' ? req.query.peer.toLowerCase() : ''
    const chainId = Number(req.query?.chainId ?? 0)
    if (!peer || !chainId) {
      json(res, 400, { error: 'Missing peer or chainId' })
      return
    }
    const [addressA, addressB] = [user, peer].sort()
    const { error } = await supabase
      .from('secret_chats')
      .delete()
      .eq('chain_id', chainId)
      .eq('address_a', addressA)
      .eq('address_b', addressB)
    if (error) {
      json(res, 500, { error: error.message })
      return
    }
    json(res, 200, { ok: true })
    return
  }

  res.status(405).end()
}

