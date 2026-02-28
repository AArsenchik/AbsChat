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

  const targetUrl = `https://backend.portal.abs.xyz/api/user/address/${encodeURIComponent(
    address
  )}`

  try {
    const response = await fetch(targetUrl, {
      headers: { accept: 'application/json' },
    })
    const contentType = response.headers.get('content-type') ?? 'application/json'
    const buffer = Buffer.from(await response.arrayBuffer())
    res.setHeader('content-type', contentType)
    res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate=300')
    res.status(response.status).send(buffer)
  } catch (error) {
    res.status(502).json({ error: 'Upstream request failed' })
  }
}
