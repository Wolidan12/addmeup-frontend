import { createClient } from 'jsr:@supabase/supabase-js@2'
export const service = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
export async function verifyAndSettle(reference: string) {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!secret) throw new Error('Payment provider is not configured')
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Provider verification unavailable')
  const result = await response.json()
  const data = result.data
  if (!result.status || data?.status !== 'success' || data.reference !== reference || !Number.isSafeInteger(data.amount) || !data.customer?.email || data.id == null) throw new Error('Provider has not confirmed a matching successful payment')
  const { data: settled, error } = await service().rpc('settle_verified_payment', {
    p_reference: reference, p_amount: data.amount, p_currency: data.currency,
    p_email: data.customer.email, p_provider_id: String(data.id),
  })
  if (error || settled !== true) throw new Error('Payment could not be reconciled with the stored order')
}
export function cors(req: Request) {
  const origin = req.headers.get('Origin')
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean)
  return origin && allowed.includes(origin) ? {
    'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  } : { 'Vary': 'Origin' }
}
