import { getAuthAddress, getSupabaseAdmin } from './_utils.js'

const GROUP_ID_REGEX = /^group:[a-z0-9-]{8,}$/i
const ADDRESS_REGEX = /^0x[0-9a-f]{40}$/i
const MISSING_TABLE_CODE = '42P01'

const json = (res, status, body) => {
  res.status(status).setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const normalizeAddress = (value) => String(value ?? '').trim().toLowerCase()

const normalizeGroupId = (value) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  return GROUP_ID_REGEX.test(raw) ? raw : ''
}

const isGroupId = (value) => Boolean(normalizeGroupId(value))

const getMemberGroupIds = async (supabase, user, groupIds = null) => {
  let query = supabase.from('group_members').select('group_id').eq('member_address', user)
  if (Array.isArray(groupIds) && groupIds.length > 0) {
    query = query.in('group_id', groupIds)
  }
  const { data, error } = await query
  if (error) return { data: [], error }
  const ids = Array.from(
    new Set(
      (Array.isArray(data) ? data : [])
        .map((row) => normalizeGroupId(row.group_id))
        .filter(Boolean),
    ),
  )
  return { data: ids, error: null }
}

const applyMessageFilters = ({
  query,
  chainId,
  txHash,
  since,
  before,
  order,
  limit,
}) => {
  let nextQuery = query
  if (chainId) nextQuery = nextQuery.eq('chain_id', chainId)
  if (txHash) nextQuery = nextQuery.eq('tx_hash', txHash)
  if (since) nextQuery = nextQuery.gt('created_at', since)
  if (before) nextQuery = nextQuery.lt('created_at', before)
  nextQuery = nextQuery.order('created_at', { ascending: order === 'asc' }).limit(limit)
  return nextQuery
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
    const peer = typeof req.query?.peer === 'string' ? req.query.peer.toLowerCase().trim() : ''
    const since = typeof req.query?.since === 'string' ? req.query.since : ''
    const before = typeof req.query?.before === 'string' ? req.query.before : ''
    const txHash = typeof req.query?.txHash === 'string' ? req.query.txHash : ''
    const chainId = Number(req.query?.chainId ?? 0)
    const limit = Math.min(Number(req.query?.limit ?? 120), 500)
    const order = req.query?.order === 'desc' ? 'desc' : 'asc'
    const normalizedLimit = Math.max(1, limit)

    if (peer) {
      if (isGroupId(peer)) {
        const memberGroups = await getMemberGroupIds(supabase, user, [peer])
        if (memberGroups.error) {
          if (memberGroups.error.code === MISSING_TABLE_CODE) {
            json(res, 500, { error: 'Group tables are missing in Supabase' })
            return
          }
          json(res, 500, { error: memberGroups.error.message })
          return
        }
        if (memberGroups.data.length === 0) {
          json(res, 403, { error: 'Forbidden' })
          return
        }
        const query = applyMessageFilters({
          query: supabase.from('messages').select('*').eq('to_address', peer),
          chainId,
          txHash,
          since,
          before,
          order,
          limit: normalizedLimit,
        })
        const { data, error } = await query
        if (error) {
          json(res, 500, { error: error.message })
          return
        }
        json(res, 200, { data: data ?? [] })
        return
      }

      const query = applyMessageFilters({
        query: supabase
          .from('messages')
          .select('*')
          .or(
            `and(from_address.eq.${user},to_address.eq.${peer}),and(from_address.eq.${peer},to_address.eq.${user})`,
          ),
        chainId,
        txHash,
        since,
        before,
        order,
        limit: normalizedLimit,
      })
      const { data, error } = await query
      if (error) {
        json(res, 500, { error: error.message })
        return
      }
      json(res, 200, { data: data ?? [] })
      return
    }

    const directLimit = Math.min(500, Math.max(normalizedLimit * 2, normalizedLimit))
    const directQuery = applyMessageFilters({
      query: supabase.from('messages').select('*').or(`from_address.eq.${user},to_address.eq.${user}`),
      chainId,
      txHash,
      since,
      before,
      order,
      limit: directLimit,
    })
    const groupIdsResult = await getMemberGroupIds(supabase, user)
    if (groupIdsResult.error && groupIdsResult.error.code !== MISSING_TABLE_CODE) {
      json(res, 500, { error: groupIdsResult.error.message })
      return
    }
    const groupIds = groupIdsResult.error?.code === MISSING_TABLE_CODE ? [] : groupIdsResult.data
    const groupQuery =
      groupIds.length > 0
        ? applyMessageFilters({
            query: supabase.from('messages').select('*').in('to_address', groupIds),
            chainId,
            txHash,
            since,
            before,
            order,
            limit: directLimit,
          })
        : null

    const [directResult, groupResult] = await Promise.all([
      directQuery,
      groupQuery ? groupQuery : Promise.resolve({ data: [], error: null }),
    ])
    if (directResult.error) {
      json(res, 500, { error: directResult.error.message })
      return
    }
    if (groupResult.error) {
      json(res, 500, { error: groupResult.error.message })
      return
    }

    const merged = new Map()
    ;[...(directResult.data ?? []), ...(groupResult.data ?? [])].forEach((row) => {
      const key = String(row.tx_hash ?? '')
      if (!key || merged.has(key)) return
      merged.set(key, row)
    })
    const rows = Array.from(merged.values()).sort((a, b) =>
      order === 'asc'
        ? String(a.created_at).localeCompare(String(b.created_at))
        : String(b.created_at).localeCompare(String(a.created_at)),
    )
    json(res, 200, { data: rows.slice(0, normalizedLimit) })
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
    const invalidTarget = normalized.find(
      (row) => !ADDRESS_REGEX.test(row.to_address) && !isGroupId(row.to_address),
    )
    if (invalidTarget) {
      json(res, 400, { error: 'Invalid to_address' })
      return
    }
    const invalid = normalized.find((row) => row.from_address !== user)
    if (invalid) {
      json(res, 403, { error: 'Forbidden' })
      return
    }
    const groupIds = Array.from(
      new Set(
        normalized
          .map((row) => normalizeGroupId(row.to_address))
          .filter(Boolean),
      ),
    )
    if (groupIds.length > 0) {
      const memberships = await getMemberGroupIds(supabase, user, groupIds)
      if (memberships.error) {
        if (memberships.error.code === MISSING_TABLE_CODE) {
          json(res, 500, { error: 'Group tables are missing in Supabase' })
          return
        }
        json(res, 500, { error: memberships.error.message })
        return
      }
      const membershipSet = new Set(memberships.data)
      const missing = groupIds.find((groupId) => !membershipSet.has(groupId))
      if (missing) {
        json(res, 403, { error: 'Forbidden' })
        return
      }
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
