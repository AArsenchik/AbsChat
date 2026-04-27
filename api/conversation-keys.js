import crypto from 'crypto'
import { getAuthAddress, getSupabaseAdmin } from './_utils.js'

const json = (res, status, body) => {
  res.status(status).setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const normalizePeers = (raw, user) =>
  Array.from(
    new Set(
      String(raw ?? '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value && value !== user),
    ),
  )

const isMissingConversationKeysTable = (error) => {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    message.includes('conversation_keys') &&
    (message.includes('does not exist') || message.includes('relation'))
  )
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

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

  const peers = normalizePeers(req.query?.peers, user)
  if (peers.length === 0) {
    json(res, 200, { mode: 'managed', data: [] })
    return
  }

  const filters = peers
    .map((peer) => {
      const [addressA, addressB] = [user, peer].sort()
      return `and(address_a.eq.${addressA},address_b.eq.${addressB})`
    })
    .join(',')

  let rows = []
  const selectConversationKeys = async () => {
    const { data, error } = await supabase
      .from('conversation_keys')
      .select('address_a, address_b, secret, created_at')
      .or(filters)
    if (error) throw error
    rows = Array.isArray(data) ? data : []
  }

  try {
    await selectConversationKeys()
  } catch (error) {
    if (isMissingConversationKeysTable(error)) {
      json(res, 200, { mode: 'legacy', data: [] })
      return
    }
    json(res, 500, { error: error instanceof Error ? error.message : 'Request failed' })
    return
  }

  const existingPeers = new Set(
    rows.map((row) => (row.address_a === user ? row.address_b : row.address_a)),
  )
  const missingPeers = peers.filter((peer) => !existingPeers.has(peer))

  if (missingPeers.length > 0) {
    const now = new Date().toISOString()
    const payload = missingPeers.map((peer) => {
      const [addressA, addressB] = [user, peer].sort()
      return {
        address_a: addressA,
        address_b: addressB,
        secret: crypto.randomBytes(32).toString('base64url'),
        created_at: now,
        updated_at: now,
      }
    })
    try {
      const { data, error } = await supabase
        .from('conversation_keys')
        .upsert(payload, { onConflict: 'address_a,address_b' })
        .select('address_a, address_b, secret, created_at')
      if (error) throw error
      rows = rows.concat(Array.isArray(data) ? data : [])
    } catch (error) {
      if (isMissingConversationKeysTable(error)) {
        json(res, 200, { mode: 'legacy', data: [] })
        return
      }
      json(res, 500, { error: error instanceof Error ? error.message : 'Request failed' })
      return
    }
  }

  const data = rows.map((row) => ({
    peer_address: row.address_a === user ? row.address_b : row.address_a,
    secret: row.secret,
    created_at: row.created_at,
  }))

  json(res, 200, { mode: 'managed', data })
}
