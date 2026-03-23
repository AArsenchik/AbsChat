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
    const peer = typeof req.query?.peer === 'string' ? req.query.peer.toLowerCase() : ''
    const since = typeof req.query?.since === 'string' ? req.query.since : ''
    const before = typeof req.query?.before === 'string' ? req.query.before : ''
    const txHash = typeof req.query?.txHash === 'string' ? req.query.txHash : ''
    const chainId = Number(req.query?.chainId ?? 0)
    const limit = Math.min(Number(req.query?.limit ?? 120), 500)
    const order = req.query?.order === 'desc' ? 'desc' : 'asc'
    let query = supabase.from('messages').select('*')
    if (chainId) query = query.eq('chain_id', chainId)
    if (peer) {
      query = query.or(
        `and(from_address.eq.${user},to_address.eq.${peer}),and(from_address.eq.${peer},to_address.eq.${user})`,
      )
    } else {
      query = query.or(`from_address.eq.${user},to_address.eq.${user}`)
    }
    if (txHash) query = query.eq('tx_hash', txHash)
    if (since) query = query.gt('created_at', since)
    if (before) query = query.lt('created_at', before)
    const orderAsc = order === 'desc' ? false : true
    query = query.order('created_at', { ascending: orderAsc }).limit(limit)
    const { data, error } = await query
    if (error) {
      json(res, 500, { error: error.message })
      return
    }
    json(res, 200, { data: data ?? [] })
    return
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const rows = Array.isArray(body.rows) ? body.rows : body ? [body] : []
    if (rows.length === 0) {
      json(res, 400, { error: 'Missing rows' })
      return
    }
    const normalized = rows.map((row) => ({
      ...row,
      from_address: String(row.from_address ?? '').toLowerCase(),
      to_address: String(row.to_address ?? '').toLowerCase(),
    }))
    const invalid = normalized.find((row) => row.from_address !== user)
    if (invalid) {
      json(res, 403, { error: 'Forbidden' })
      return
    }
    const { data, error } = await supabase.from('messages').upsert(normalized, {
      onConflict: 'tx_hash',
    })
    if (error) {
      json(res, 500, { error: error.message })
      return
    }
    json(res, 200, { data: data ?? [] })
    return
  }

  res.status(405).end()
}
