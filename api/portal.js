const PORTAL_BASE = 'https://backend.portal.abs.xyz'
const ABSCOPE_SUGGEST_BASE = 'https://abscope.live/api/suggest'

const normalizeAddress = (value) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  if (/^0x[0-9a-f]{40}$/.test(raw)) return raw
  if (/^[0-9a-f]{40}$/.test(raw)) return `0x${raw}`
  return ''
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

const fetchJson = async (url) => {
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    return await response.json().catch(() => null)
  } catch {
    return null
  }
}

const sendJson = (res, status, payload) => {
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate=300')
  res.status(status).send(JSON.stringify(payload))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const addressParam = req.query?.address
  const address = Array.isArray(addressParam) ? addressParam[0] : addressParam

  if (!address || typeof address !== 'string') {
    res.status(400).json({ error: 'Missing address' })
    return
  }

  const normalized = address.trim().toLowerCase()
  const normalizedAddress = normalizeAddress(normalized)
  const stripped = normalizedAddress.startsWith('0x')
    ? normalizedAddress.slice(2)
    : normalized
  const prefixed = normalizeAddress(normalized) || `0x${normalized}`
  const candidates = Array.from(
    new Set([
      `${PORTAL_BASE}/api/user/address/${encodeURIComponent(prefixed)}`,
      `${PORTAL_BASE}/api/user/address/${encodeURIComponent(stripped)}`,
    ]),
  )

  try {
    for (const targetUrl of candidates) {
      const response = await fetch(targetUrl, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) continue
      const contentType = response.headers.get('content-type') ?? 'application/json'
      const buffer = Buffer.from(await response.arrayBuffer())
      res.setHeader('content-type', contentType)
      res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate=300')
      res.status(200).send(buffer)
      return
    }

    const streamerPayload = await fetchJson(
      `${PORTAL_BASE}/api/streamer/${encodeURIComponent(normalized)}`,
    )

    if (streamerPayload?.streamer?.walletAddress) {
      const streamerAddress = normalizeAddress(streamerPayload.streamer.walletAddress)
      if (streamerAddress) {
        const direct = await fetch(
          `${PORTAL_BASE}/api/user/address/${encodeURIComponent(streamerAddress)}`,
          { headers: { accept: 'application/json' } },
        )
        if (direct.ok) {
          const contentType = direct.headers.get('content-type') ?? 'application/json'
          const buffer = Buffer.from(await direct.arrayBuffer())
          res.setHeader('content-type', contentType)
          res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate=300')
          res.status(200).send(buffer)
          return
        }
      }
    }

    const streamerId = parsePortalUserIdFromError(streamerPayload?.error)
    if (streamerId) {
      const byId = await fetch(
        `${PORTAL_BASE}/api/user/${encodeURIComponent(streamerId)}`,
        { headers: { accept: 'application/json' } },
      )
      if (byId.ok) {
        const contentType = byId.headers.get('content-type') ?? 'application/json'
        const buffer = Buffer.from(await byId.arrayBuffer())
        res.setHeader('content-type', contentType)
        res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate=300')
        res.status(200).send(buffer)
        return
      }
    }

    const suggestPayload = await fetchJson(
      `${ABSCOPE_SUGGEST_BASE}?query=${encodeURIComponent(
        normalized,
      )}&suggest=1&limit=1`,
    )
    const suggestion = Array.isArray(suggestPayload?.suggestions)
      ? suggestPayload.suggestions[0]
      : null
    const suggestedAddress = normalizeAddress(
      suggestion?.resolvedWallet ?? suggestion?.walletAddress ?? '',
    )

    if (suggestedAddress) {
      const byAddress = await fetch(
        `${PORTAL_BASE}/api/user/address/${encodeURIComponent(suggestedAddress)}`,
        { headers: { accept: 'application/json' } },
      )
      if (byAddress.ok) {
        const contentType = byAddress.headers.get('content-type') ?? 'application/json'
        const buffer = Buffer.from(await byAddress.arrayBuffer())
        res.setHeader('content-type', contentType)
        res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate=300')
        res.status(200).send(buffer)
        return
      }

      const suggestedName =
        typeof suggestion?.username === 'string' && suggestion.username.trim()
          ? suggestion.username.trim()
          : null
      if (suggestedName) {
        sendJson(res, 200, {
          user: {
            name: suggestedName,
            walletAddress: suggestedAddress,
            overrideProfilePictureUrl:
              typeof suggestion?.avatar === 'string' ? suggestion.avatar : null,
          },
        })
        return
      }
    }

    res.status(404).json({ error: 'User not found' })
  } catch (error) {
    res.status(502).json({ error: 'Upstream request failed' })
  }
}
