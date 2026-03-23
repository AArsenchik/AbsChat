import { verifyMessage } from 'viem'
import { signJwt } from './_utils.js'

const json = (res, status, body) => {
  res.status(status).setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const getSecret = () => process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || ''

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }
  const secret = getSecret()
  if (!secret) {
    json(res, 500, { error: 'Missing JWT secret' })
    return
  }
  try {
    const { address, message, signature } = req.body || {}
    if (!address || !message || !signature) {
      json(res, 400, { error: 'Invalid payload' })
      return
    }
    const addressLower = String(address).toLowerCase()
    const valid = await verifyMessage({
      address: addressLower,
      message,
      signature,
    })
    if (!valid) {
      json(res, 401, { error: 'Invalid signature' })
      return
    }
    const now = Math.floor(Date.now() / 1000)
    const exp = now + 60 * 60 * 24 * 7
    const token = signJwt(
      {
        sub: addressLower,
        role: 'authenticated',
        aud: 'authenticated',
        iat: now,
        exp,
      },
      secret,
    )
    json(res, 200, { access_token: token, expires_at: exp })
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : 'Auth failed' })
  }
}

