import { getAuthAddress } from './_utils.js'

const json = (res, status, body) => {
  res.status(status).setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const ipfsToHttp = (value) => {
  if (typeof value !== 'string' || !value) return null
  if (value.startsWith('ipfs://ipfs/')) {
    return `https://ipfs.io/ipfs/${value.slice('ipfs://ipfs/'.length)}`
  }
  if (value.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${value.slice('ipfs://'.length)}`
  }
  return value
}

const pickImageUrl = (nft) => {
  const candidates = [
    nft?.display_image_url,
    nft?.image_url,
    nft?.image?.url,
    nft?.metadata?.image_url,
    nft?.metadata?.image,
    nft?.media_url,
  ]
  for (const candidate of candidates) {
    const normalized = ipfsToHttp(candidate)
    if (typeof normalized === 'string' && normalized) {
      return normalized
    }
  }
  return null
}

const normalizeNft = (nft) => {
  const identifier = String(nft?.identifier ?? nft?.token_id ?? '').trim()
  const contractAddress = String(
    nft?.contract ?? nft?.contract_address ?? nft?.asset_contract?.address ?? '',
  ).trim()
  const imageUrl = pickImageUrl(nft)
  if (!identifier || !contractAddress || !imageUrl) return null
  const collectionName =
    typeof nft?.collection === 'string'
      ? nft.collection
      : typeof nft?.collection?.name === 'string'
        ? nft.collection.name
        : typeof nft?.collection?.slug === 'string'
          ? nft.collection.slug
          : null
  const defaultName = collectionName
    ? `${collectionName} #${identifier}`
    : `NFT #${identifier}`
  return {
    id: `${contractAddress.toLowerCase()}:${identifier}`,
    name:
      typeof nft?.name === 'string' && nft.name.trim()
        ? nft.name.trim()
        : defaultName,
    collectionName,
    imageUrl,
  }
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

  const addressParam = Array.isArray(req.query?.address)
    ? req.query.address[0]
    : req.query?.address
  const address = typeof addressParam === 'string' ? addressParam.toLowerCase() : ''
  if (!address || address !== user) {
    json(res, 403, { error: 'Forbidden' })
    return
  }

  const apiKey = process.env.OPENSEA_API_KEY
  if (!apiKey) {
    json(res, 503, {
      error: 'OpenSea API key is not configured on the server',
    })
    return
  }

  try {
    const limit = 200
    const rows = []
    let cursor = null
    let pageCount = 0

    while (pageCount < 25) {
      const params = new URLSearchParams({ limit: String(limit) })
      if (cursor) {
        params.set('next', cursor)
        params.set('next.value', cursor)
      }
      const targetUrl = `https://api.opensea.io/api/v2/chain/abstract/account/${encodeURIComponent(
        address,
      )}/nfts?${params.toString()}`

      const response = await fetch(targetUrl, {
        headers: {
          accept: 'application/json',
          'x-api-key': apiKey,
        },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const upstreamError =
          Array.isArray(data?.errors) && data.errors.length > 0
            ? data.errors.join(', ')
            : data?.detail || data?.error || 'Failed to load NFTs'
        json(res, response.status, { error: upstreamError })
        return
      }

      const pageRows = Array.isArray(data?.nfts) ? data.nfts : []
      rows.push(...pageRows)
      const nextCursor =
        typeof data?.next === 'string'
          ? data.next
          : typeof data?.next?.value === 'string'
            ? data.next.value
            : null
      pageCount += 1
      if (!nextCursor) break
      cursor = nextCursor
    }
    const normalized = rows
      .map(normalizeNft)
      .filter(Boolean)

    json(res, 200, { data: normalized })
  } catch (error) {
    json(res, 502, { error: 'Failed to reach OpenSea' })
  }
}
