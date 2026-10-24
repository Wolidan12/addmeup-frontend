// Sensitive admin actions: caller must have admin/moderator row in user_roles (checked server-side with service role)
import { createClient } from 'jsr:@supabase/supabase-js@2'
Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') || ''; const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: { user } } = await sb.auth.getUser(auth.replace('Bearer ', '')); if (!user) return new Response('unauthorized', { status: 401 })
  const { data: role } = await sb.from('user_roles').select('role').eq('user_id', user.id).single(); if (!role || !['admin', 'moderator'].includes(role.role)) return new Response('admin only', { status: 403 })
  const { action, target } = await req.json(); await sb.from('audit_logs').insert({ actor_id: user.id, action, target })
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
