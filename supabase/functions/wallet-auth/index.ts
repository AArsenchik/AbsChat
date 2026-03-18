import { verifyMessage } from 'https://esm.sh/viem@2.46.1'
import { SignJWT } from 'https://esm.sh/jose@5.2.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const address =
      typeof body?.address === 'string' ? body.address.toLowerCase() : ''
    const message = typeof body?.message === 'string' ? body.message : ''
    const signature = typeof body?.signature === 'string' ? body.signature : ''

    if (!address || !message || !signature) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const valid = await verifyMessage({
      address,
      message,
      signature,
    })

    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const jwtSecret = Deno.env.get('JWT_SECRET')
    if (!jwtSecret) {
      return new Response(JSON.stringify({ error: 'Missing JWT secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const expiresAt =
      Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10
    const token = await new SignJWT({
      role: 'authenticated',
      wallet_address: address,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(address)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(new TextEncoder().encode(jwtSecret))

    return new Response(
      JSON.stringify({ access_token: token, expires_at: expiresAt }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
