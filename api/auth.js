import { verifyMessage } from 'viem'
import { signJwt } from './_utils.js'

const json = (res, status, body) => {
  res.status(status).setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const getSecret = () => process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || ''

const extractSignatureString = (value) => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const raw = value.signature ?? value.data ?? value.sig
    if (typeof raw === 'string') return raw
    const nested = value.signature?.data
    if (typeof nested === 'string') return nested
  }
  return ''
}

const hexNormalize = (hex) => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (!clean) return ''
  if (!/^[0-9a-fA-F]+$/.test(clean)) return ''
  if (clean.length === 130) return `0x${clean}`
  if (clean.length === 132 && hex.startsWith('0x')) return `0x${clean.slice(2)}`
  return ''
}

const base64ToHex = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const buffer = Buffer.from(normalized, 'base64')
  if (buffer.length !== 65) return ''
  return `0x${buffer.toString('hex')}`
}

const signatureFromParts = (value) => {
  if (!value || typeof value !== 'object') return ''
  const r = value.r
  const s = value.s
  const v = value.v ?? value.recovery ?? value.yParity
  if (typeof r !== 'string' || typeof s !== 'string') return ''
  const rClean = r.startsWith('0x') ? r.slice(2) : r
  const sClean = s.startsWith('0x') ? s.slice(2) : s
  if (!/^[0-9a-fA-F]+$/.test(rClean + sClean)) return ''
  const vNum = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(vNum)) return ''
  const vByte = vNum < 27 ? vNum + 27 : vNum
  const vHex = vByte.toString(16).padStart(2, '0')
  const rHex = rClean.padStart(64, '0')
  const sHex = sClean.padStart(64, '0')
  return `0x${rHex}${sHex}${vHex}`
}

const normalizeSignature = (value) => {
  const raw = extractSignatureString(value)
  if (!raw && value && typeof value === 'object') {
    const fromParts = signatureFromParts(value)
    if (fromParts) return fromParts
  }
  if (!raw) return ''
  const hex = hexNormalize(raw)
  if (hex) return hex
  try {
    const asHex = base64ToHex(raw)
    if (asHex) return asHex
  } catch {
    return ''
  }
  return ''
}

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
    const normalizedSignature = normalizeSignature(signature)
    if (!address || !message || !normalizedSignature) {
      json(res, 400, { error: 'Invalid payload or signature format' })
      return
    }
    const addressLower = String(address).toLowerCase()
    const valid = await verifyMessage({
      address: addressLower,
      message,
      signature: normalizedSignature,
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
