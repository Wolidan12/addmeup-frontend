import { verifyAndSettle } from '../_shared/paystack.ts'
async function signature(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')
}
function equal(a: string, b: string) { let diff = a.length ^ b.length; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0); return diff === 0 }
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('POST required', { status: 405 })
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!secret) return new Response('Provider unavailable', { status: 503 })
  const body = await req.text()
  if (!equal(await signature(secret, body), req.headers.get('x-paystack-signature') || '')) return new Response('Invalid signature', { status: 401 })
  try {
    const event = JSON.parse(body)
    if (event.event !== 'charge.success') return new Response('Ignored')
    const reference = event.data?.reference
    if (typeof reference !== 'string' || reference.length > 120) return new Response('Invalid reference', { status: 400 })
    await verifyAndSettle(reference)
    return new Response('OK')
  } catch {
    // Non-2xx allows provider retries; no acknowledgement of unpersisted success.
    return new Response('Reconciliation failed', { status: 422 })
  }
})
