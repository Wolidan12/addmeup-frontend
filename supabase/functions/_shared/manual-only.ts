// Deliberately fail closed: online checkout/verification/webhooks are retired.
// No secrets are read and no provider or database calls are made.
export function manualOnly(req: Request): Response {
  const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}
  if (req.method === 'OPTIONS') return new Response(null, {status:204,headers})
  return new Response(JSON.stringify({error:'Online payments are disabled. Use manual bank transfer and independent finance review.'}), {status:410,headers})
}
