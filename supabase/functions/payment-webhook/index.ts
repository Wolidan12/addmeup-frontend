// Paystack webhook: verify HMAC-SHA512 signature with secret, then re-verify with provider API. Never trust payload alone.
import { createClient } from 'jsr:@supabase/supabase-js@2'
async function hmac(secret: string, body: string) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']); const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(body)); return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, '0')).join('') }
Deno.serve(async (req) => {
  const body = await req.text(); const sig = req.headers.get('x-paystack-signature') || ''
  if (await hmac(Deno.env.get('PAYSTACK_SECRET_KEY')!, body) !== sig) return new Response('invalid signature', { status: 401 })
  const ev = JSON.parse(body); if (ev.event !== 'charge.success') return new Response('ignored')
  const ref = ev.data.reference; const v = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` } }); const j = await v.json()
  if (j?.data?.status !== 'success') return new Response('not verified', { status: 400 })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  await sb.from('payment_transactions').update({ status: 'verified', verified_at: new Date().toISOString() }).eq('reference', ref)
  return new Response('ok')
})
