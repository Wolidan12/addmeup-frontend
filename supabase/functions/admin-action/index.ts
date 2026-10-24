// Retired: this previously acknowledged actions without performing them.
// Administrative mutations now use the transactionally audited admin_mutate RPC.
Deno.serve(() => new Response(JSON.stringify({ error: 'Use the authorized admin_mutate database RPC' }), {
  status: 410, headers: { 'Content-Type': 'application/json' },
}))
