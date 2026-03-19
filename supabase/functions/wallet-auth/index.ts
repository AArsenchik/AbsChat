const denoGlobal = globalThis as unknown as {
  Deno?: {
    env?: { get?: (key: string) => string | undefined }
    serve?: (handler: (req: Request) => Response | Promise<Response>) => void
  }
}
const jwtSecret = denoGlobal.Deno?.env?.get?.('JWT_SECRET')
const serve = denoGlobal.Deno?.serve

const buildResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    },
  })

serve?.(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  if (!jwtSecret) {
    return buildResponse({ error: 'Missing SUPABASE_JWT_SECRET' }, 500)
  }

  try {
    const payload = await req.json()
    const address = typeof payload?.address === 'string' ? payload.address : ''
    const message = typeof payload?.message === 'string' ? payload.message : ''
    const signature = typeof payload?.signature === 'string' ? payload.signature : ''
    if (!address || !message || !signature) {
      return buildResponse({ error: 'Invalid payload' }, 400)
    }
    const addressLower = address.toLowerCase()
    if (!message.includes(`Address: ${addressLower}`)) {
      return buildResponse({ error: 'Address mismatch' }, 401)
    }
    const ethersUrl = 'https://esm.sh/ethers@6.13.1'
    const { verifyMessage } = (await import(ethersUrl)) as unknown as {
      verifyMessage: (message: string, signature: string) => Promise<string>
    }
    const recovered = await verifyMessage(message, signature)
    if (!recovered || recovered.toLowerCase() !== addressLower) {
      return buildResponse({ error: 'Invalid signature' }, 401)
    }
    const now = Math.floor(Date.now() / 1000)
    const exp = now + 60 * 60 * 24 * 7
    const key = new TextEncoder().encode(jwtSecret)
    const joseUrl = 'https://esm.sh/jose@5.2.4'
    const { SignJWT } = (await import(joseUrl)) as unknown as {
      SignJWT: new (payload: Record<string, unknown>) => {
        setProtectedHeader: (header: Record<string, unknown>) => unknown
        setSubject: (subject: string) => unknown
        setAudience: (audience: string) => unknown
        setIssuedAt: (issuedAt: number) => unknown
        setExpirationTime: (expiration: number) => unknown
        sign: (key: Uint8Array) => Promise<string>
      }
    }
    const signer = new SignJWT({ role: 'authenticated' }) as unknown as {
      setProtectedHeader: (header: Record<string, unknown>) => typeof signer
      setSubject: (subject: string) => typeof signer
      setAudience: (audience: string) => typeof signer
      setIssuedAt: (issuedAt: number) => typeof signer
      setExpirationTime: (expiration: number) => typeof signer
      sign: (key: Uint8Array) => Promise<string>
    }
    const accessToken = await signer
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(addressLower)
      .setAudience('authenticated')
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(key)
    return buildResponse({ access_token: accessToken, expires_at: exp })
  } catch (err) {
    return buildResponse({ error: err instanceof Error ? err.message : 'Auth failed' }, 500)
  }
})
