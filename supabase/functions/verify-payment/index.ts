import { service, verifyAndSettle, cors } from '../_shared/paystack.ts'
Deno.serve(async req => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' }
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return reply(405, { error: 'POST required' })
  try {
    const sb = service()
    const { data: { user }, error } = await sb.auth.getUser((req.headers.get('Authorization') || '').replace(/^Bearer /, ''))
    if (error || !user) return reply(401, { error: 'Authentication required' })
    const { reference, reason } = await req.json()
    if (typeof reference !== 'string' || !/^[a-zA-Z0-9._=-]{1,120}$/.test(reference)) return reply(400, { error: 'Invalid reference' })
    const { data: payment, error: lookupError } = await sb.from('payment_transactions').select('user_id,provider').eq('reference', reference).maybeSingle()
    const { data: role } = await sb.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (lookupError || !payment || (payment.user_id !== user.id && !['admin', 'super_admin', 'finance_admin'].includes(role?.role))) return reply(403, { error: 'Payment access denied' })
    if (payment.provider !== 'paystack') return reply(400, { error: 'Provider integration is not configured' })
    if (typeof reason !== 'string' || reason.trim().length < 8 || reason.length > 1000) return reply(400, { error: 'A verification reason is required' })
    const { error: auditError } = await sb.from('audit_logs').insert({ actor_id: user.id, action: 'payment_verification_requested', target: reference, meta: { reason } })
    if (auditError) return reply(503, { error: 'Could not record verification request' })
    await verifyAndSettle(reference)
    return reply(200, { verified: true })
  } catch (error) {
    console.error('Payment verification failed; provider details redacted')
    return reply(422, { verified: false, error: 'Unable to verify and reconcile payment. Retry or contact finance.' })
  }
})
