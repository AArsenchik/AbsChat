import { getAuthAddress, getSupabaseAdmin } from './_utils.js'

const PORTAL_BASE = 'https://backend.portal.abs.xyz'
const ABSCOPE_SUGGEST_BASE = 'https://abscope.live/api/suggest'
const PORTAL_PROFILE_CACHE_TTL = 10 * 60 * 1000
const PORTAL_SEARCH_CACHE_TTL = 60 * 1000

const portalProfileCache = new Map()
const portalSearchCache = new Map()

const json = (res, status, body) => {
  res.status(status).setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const normalizeQuery = (value) => String(value ?? '').trim().toLowerCase()

const normalizeAddress = (value) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  if (/^0x[0-9a-f]{40}$/.test(raw)) return raw
  if (/^[0-9a-f]{40}$/.test(raw)) return `0x${raw}`
  return ''
}

const toPositiveInteger = (value) => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10)
    return parsed > 0 ? parsed : null
  }
  return null
}

const buildPortalAvatarAssetUrl = (asset) => {
  if (!asset || typeof asset !== 'object') return null
  const season = toPositiveInteger(asset.season)
  const tier = toPositiveInteger(asset.tier)
  const key = toPositiveInteger(asset.key)
  if (!season || !tier || !key) return null
  return `https://abstract-assets.abs.xyz/avatars/${season}-${tier}-${key}.png`
}

const extractPortalAvatarUrl = (user) => {
  if (!user || typeof user !== 'object') return null
  if (typeof user.overrideProfilePictureUrl === 'string' && user.overrideProfilePictureUrl.trim()) {
    return user.overrideProfilePictureUrl.trim()
  }
  return buildPortalAvatarAssetUrl(user.avatar)
}

const scoreName = (name, query) => {
  const normalized = normalizeQuery(name)
  if (!normalized) return 99
  if (normalized === query) return 0
  if (normalized.startsWith(query)) return 1
  if (normalized.includes(query)) return 2
  return 99
}

const withTimeout = async (promise, timeoutMs) => {
  let timeoutId = null
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Timeout')), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const fetchJson = async (url) => {
  try {
    const response = await withTimeout(
      fetch(url, { headers: { accept: 'application/json' } }),
      5000,
    )
    if (!response.ok) return null
    return await response.json().catch(() => null)
  } catch {
    return null
  }
}

const buildAddressLookupVariants = (address) => {
  const normalized = normalizeAddress(address)
  if (!normalized) return []
  if (normalized.startsWith('0x')) {
    return [normalized, normalized.slice(2)]
  }
  return [`0x${normalized}`, normalized]
}

const extractPortalUser = (input) => {
  if (!input || typeof input !== 'object') return null
  const source = input.user && typeof input.user === 'object' ? input.user : input

  const nameCandidates = [
    source.name,
    source.displayName,
    source.display_name,
    source.username,
    source.handle,
  ]
  const addressCandidates = [
    source.walletAddress,
    source.wallet_address,
    source.smartWalletAddress,
    source.smart_wallet_address,
    source.address,
  ]
  const avatarCandidates = [
    source.overrideProfilePictureUrl,
    source.profilePictureUrl,
    source.profile_picture_url,
  ]

  const address = addressCandidates.map(normalizeAddress).find(Boolean) ?? ''
  if (!address) return null

  const name = nameCandidates.find((value) => typeof value === 'string' && value.trim())
  const normalizedName = typeof name === 'string' ? name.trim() : null
  if (!normalizedName) return null

  const directAvatar = avatarCandidates.find(
    (value) => typeof value === 'string' && value.trim(),
  )
  const avatarUrl =
    (typeof directAvatar === 'string' ? directAvatar.trim() : null) ??
    extractPortalAvatarUrl(source)

  return {
    address,
    name: normalizedName,
    avatarUrl: avatarUrl ?? null,
  }
}

const collectPortalUsers = (payload) => {
  const results = []
  const seen = new Set()
  const stack = [payload]
  let visited = 0
  const maxNodes = 5000

  while (stack.length > 0 && visited < maxNodes) {
    const current = stack.pop()
    visited += 1
    if (!current) continue

    if (Array.isArray(current)) {
      current.forEach((item) => stack.push(item))
      continue
    }

    if (typeof current !== 'object') continue

    const parsed = extractPortalUser(current)
    if (parsed && !seen.has(parsed.address)) {
      seen.add(parsed.address)
      results.push(parsed)
    }

    Object.values(current).forEach((value) => {
      if (value && (Array.isArray(value) || typeof value === 'object')) {
        stack.push(value)
      }
    })
  }

  return results
}

const fetchPortalProfile = async (address) => {
  const key = normalizeAddress(address)
  if (!key) return null

  const cached = portalProfileCache.get(key)
  if (cached && Date.now() - cached.ts < PORTAL_PROFILE_CACHE_TTL) {
    return cached.value
  }

  const variants = buildAddressLookupVariants(key)
  for (const candidate of variants) {
    const data = await fetchJson(
      `${PORTAL_BASE}/api/user/address/${encodeURIComponent(candidate)}`,
    )
    const profile = extractPortalUser(data)
    if (profile) {
      portalProfileCache.set(key, { value: profile, ts: Date.now() })
      return profile
    }
  }

  portalProfileCache.set(key, { value: null, ts: Date.now() })
  return null
}

const buildPortalSearchUrls = (query, limit) => {
  const q = encodeURIComponent(query)
  const lim = encodeURIComponent(String(limit))
  return [
    `${PORTAL_BASE}/api/user/search?q=${q}&limit=${lim}`,
    `${PORTAL_BASE}/api/user/search?query=${q}&limit=${lim}`,
    `${PORTAL_BASE}/api/users/search?q=${q}&limit=${lim}`,
    `${PORTAL_BASE}/api/users/search?query=${q}&limit=${lim}`,
    `${PORTAL_BASE}/api/search/users?q=${q}&limit=${lim}`,
    `${PORTAL_BASE}/api/search?q=${q}&limit=${lim}`,
    `${PORTAL_BASE}/api/users?search=${q}&limit=${lim}`,
    `${PORTAL_BASE}/api/users?query=${q}&limit=${lim}`,
  ]
}

const parsePortalUserIdFromError = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null
  const patterns = [/\bid\s+(\d+)\b/i, /\bwith id\s+(\d+)\b/i, /\((\d+)\)/]
  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

const fetchPortalUserById = async (id) => {
  const userId = toPositiveInteger(id)
  if (!userId) return null
  const data = await fetchJson(`${PORTAL_BASE}/api/user/${encodeURIComponent(String(userId))}`)
  return extractPortalUser(data)
}

const selectBestPortalUser = (users, query) => {
  if (!Array.isArray(users) || users.length === 0) return null
  const normalizedQuery = normalizeQuery(query)
  let best = null
  for (const user of users) {
    if (!best) {
      best = user
      continue
    }
    const currentScore = scoreName(best.name, normalizedQuery)
    const nextScore = scoreName(user.name, normalizedQuery)
    if (nextScore < currentScore) {
      best = user
      continue
    }
    if (nextScore === currentScore && user.name.localeCompare(best.name) < 0) {
      best = user
    }
  }
  return best
}

const fetchPortalProfileByUsername = async (query) => {
  const username = String(query ?? '').trim()
  if (!username) return null

  const data = await fetchJson(`${PORTAL_BASE}/api/streamer/${encodeURIComponent(username)}`)
  if (!data || typeof data !== 'object') return null

  const directUsers = collectPortalUsers(data)
  const directMatch = selectBestPortalUser(directUsers, username)
  if (directMatch) return directMatch

  const userIdCandidates = new Set()

  const directId = toPositiveInteger(data?.id)
  if (directId) userIdCandidates.add(directId)

  const streamerId = toPositiveInteger(data?.streamer?.id)
  if (streamerId) userIdCandidates.add(streamerId)

  const userId = toPositiveInteger(data?.user?.id)
  if (userId) userIdCandidates.add(userId)

  const errorId = parsePortalUserIdFromError(data?.error)
  const parsedErrorId = toPositiveInteger(errorId)
  if (parsedErrorId) userIdCandidates.add(parsedErrorId)

  for (const candidate of userIdCandidates) {
    const profile = await fetchPortalUserById(candidate)
    if (profile?.name) return profile
  }

  return null
}

const fetchAbscopeSuggestions = async (query, limit) => {
  const normalized = normalizeQuery(query)
  if (!normalized) return []

  const cappedLimit = Math.max(1, Math.min(20, limit))
  const data = await fetchJson(
    `${ABSCOPE_SUGGEST_BASE}?query=${encodeURIComponent(
      String(query ?? '').trim(),
    )}&suggest=1&limit=${encodeURIComponent(String(cappedLimit))}`,
  )
  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : []
  const mapped = []
  const seen = new Set()

  for (const item of suggestions) {
    const address = normalizeAddress(
      item?.resolvedWallet ?? item?.walletAddress ?? item?.address,
    )
    const name =
      typeof item?.username === 'string' && item.username.trim()
        ? item.username.trim()
        : typeof item?.name === 'string' && item.name.trim()
          ? item.name.trim()
          : ''
    if (!address || !name || seen.has(address)) continue
    seen.add(address)
    const avatarUrl =
      typeof item?.avatar === 'string' && item.avatar.trim()
        ? item.avatar.trim()
        : null
    mapped.push({
      address,
      name,
      avatarUrl,
    })
  }

  return mapped
}

const fetchPortalSearchResults = async (query, limit) => {
  const cacheKey = `${query}:${limit}`
  const cached = portalSearchCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PORTAL_SEARCH_CACHE_TTL) {
    return cached.value
  }

  const merged = []
  const seenAddresses = new Set()
  const addProfile = (profile) => {
    const address = normalizeAddress(profile?.address)
    const name = typeof profile?.name === 'string' ? profile.name.trim() : ''
    if (!address || !name || seenAddresses.has(address)) return
    seenAddresses.add(address)
    merged.push({
      address,
      name,
      avatarUrl: typeof profile?.avatarUrl === 'string' ? profile.avatarUrl : null,
    })
  }

  const exactMatch = await fetchPortalProfileByUsername(query)
  if (exactMatch) addProfile(exactMatch)

  const suggestMatches = await fetchAbscopeSuggestions(query, Math.max(limit * 2, 6))
  suggestMatches.forEach(addProfile)

  if (merged.length < limit) {
    for (const url of buildPortalSearchUrls(query, limit)) {
      const data = await fetchJson(url)
      if (!data) continue
      const users = collectPortalUsers(data)
      users.forEach(addProfile)
      if (merged.length >= limit) break
    }
  }

  const value = merged.slice(0, Math.max(limit, 1))
  portalSearchCache.set(cacheKey, { value, ts: Date.now() })
  return value
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const user = getAuthAddress(req)
  if (!user) {
    json(res, 401, { error: 'Unauthorized' })
    return
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    json(res, 500, { error: 'Supabase admin not configured' })
    return
  }

  const qParam = Array.isArray(req.query?.q) ? req.query.q[0] : req.query?.q
  const query = normalizeQuery(qParam)
  if (query.length < 2) {
    json(res, 200, { data: [] })
    return
  }

  const limitParam = Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit
  const limitNumber = Number.parseInt(String(limitParam ?? '8'), 10)
  const limit = Number.isFinite(limitNumber) ? Math.max(1, Math.min(16, limitNumber)) : 8

  const results = []
  const seen = new Set()
  const addResult = (item, score) => {
    const address = normalizeAddress(item?.address)
    const name = typeof item?.name === 'string' ? item.name.trim() : ''
    if (!address || !name || seen.has(address) || address === user) return
    seen.add(address)
    results.push({
      address,
      name,
      avatarUrl: typeof item?.avatarUrl === 'string' ? item.avatarUrl : null,
      score,
    })
  }

  const { data: customProfileRows, error: customProfileError } = await supabase
    .from('profiles')
    .select('address, display_name, avatar_url')
    .ilike('display_name', `%${query}%`)
    .limit(limit * 6)

  if (customProfileError) {
    json(res, 500, { error: customProfileError.message })
    return
  }

  ;(customProfileRows ?? []).forEach((row) => {
    const address = normalizeAddress(row?.address)
    const name =
      typeof row?.display_name === 'string' && row.display_name.trim()
        ? row.display_name.trim()
        : ''
    if (!address || !name) return
    addResult(
      {
        address,
        name,
        avatarUrl: typeof row?.avatar_url === 'string' ? row.avatar_url : null,
      },
      scoreName(name, query),
    )
  })

  const portalMatches = await fetchPortalSearchResults(query, limit * 6)
  portalMatches.forEach((profile) => {
    addResult(profile, scoreName(profile.name, query))
  })

  const queryAsAddress = normalizeAddress(query)
  if (queryAsAddress) {
    const profile = await fetchPortalProfile(queryAsAddress)
    if (profile?.name) {
      addResult(profile, 0)
    }
  }

  const { data: recentMessages, error: recentMessagesError } = await supabase
    .from('messages')
    .select('from_address, to_address, created_at')
    .order('created_at', { ascending: false })
    .limit(320)

  if (recentMessagesError) {
    json(res, 500, { error: recentMessagesError.message })
    return
  }

  const candidateAddresses = []
  const candidateSeen = new Set()
  ;(recentMessages ?? []).forEach((row) => {
    ;[row?.from_address, row?.to_address].forEach((value) => {
      const address = normalizeAddress(value)
      if (!address || address === user || candidateSeen.has(address)) return
      candidateSeen.add(address)
      candidateAddresses.push(address)
    })
  })

  for (let index = 0; index < candidateAddresses.length && results.length < limit; index += 6) {
    const chunk = candidateAddresses.slice(index, index + 6)
    const profiles = await Promise.all(chunk.map((address) => fetchPortalProfile(address)))
    profiles.forEach((profile) => {
      if (!profile) return
      const score = scoreName(profile.name, query)
      if (score > 2) return
      addResult(profile, score)
    })
  }

  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return a.name.localeCompare(b.name)
  })

  json(res, 200, {
    data: results.slice(0, limit).map(({ score, ...item }) => item),
  })
}
