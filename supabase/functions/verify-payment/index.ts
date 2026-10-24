// Verify a payment DIRECTLY with provider before marking verified. Secrets: PAYSTACK_SECRET_KEY (Edge Function secret, never frontend)
import { createClient } from 'jsr:@supabase/supabase-js@2'
Deno.serve(async (req) => {
  const { reference } = await req.json().catch(() => ({})); if (!reference) return new Response('reference required', { status: 400 })
  const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` } })
  const j = await r.json(); if (j?.data?.status !== 'success') return new Response(JSON.stringify({ verified: false }), { headers: { 'Content-Type': 'application/json' } })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await sb.from('payment_transactions').update({ status: 'verified', verified_at: new Date().toISOString() }).eq('reference', reference).eq('amount_kobo', j.data.amount)
  return new Response(JSON.stringify({ verified: !error }), { headers: { 'Content-Type': 'application/json' } })
})
