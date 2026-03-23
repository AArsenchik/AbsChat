import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const getEnv = (key) => process.env[key] || ''

const base64url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

export const signJwt = (payload, secret) => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const data = `${encodedHeader}.${encodedPayload}`
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64')
  const encodedSignature = signature.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${data}.${encodedSignature}`
}

export const verifyJwt = (token, secret) => {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, signature] = parts
  const data = `${headerB64}.${payloadB64}`
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64')
  const expectedSig = expected.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  if (expectedSig !== signature) return null
  const json = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
  const payload = JSON.parse(json)
  if (payload.exp && Date.now() / 1000 > payload.exp) return null
  return payload
}

export const getAuthAddress = (req) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const secret = getEnv('JWT_SECRET') || getEnv('SUPABASE_JWT_SECRET')
  if (!secret) return null
  const payload = verifyJwt(token, secret)
  const sub = payload?.sub
  return typeof sub === 'string' ? sub.toLowerCase() : null
}

export const getSupabaseAdmin = () => {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return null
  return createClient(supabaseUrl, serviceKey)
}

