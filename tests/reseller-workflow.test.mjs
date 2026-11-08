// Real isolated SQL, never production data or provider calls.
import {PGlite} from '@electric-sql/pglite'
import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const db=new PGlite()
try{
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1];await db.exec(bootstrap)
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()')
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort())await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
 await db.exec(await readFile('supabase/manual/reseller_workflow.sql','utf8'))
 const root=crypto.randomUUID(),member=crypto.randomUUID(),mod=crypto.randomUUID(),finance=crypto.randomUUID()
 for(const [id,role] of [[root,'super_admin'],[member,'user'],[mod,'moderator'],[finance,'finance_admin']]){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.org']);if(role!=='user')await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[id,role])}
 await db.query('insert into public.points_balance(user_id,balance) values($1,90)',[member])
 const snapshot=async()=>JSON.stringify((await db.query('select (select jsonb_agg(u order by id) from auth.users u) users,(select jsonb_agg(p order by id) from public.profiles p) profiles,(select jsonb_agg(b order by user_id) from public.points_balance b) balances,(select jsonb_agg(l order by id) from public.points_ledger l) ledger')).rows)
 const before=await snapshot(),order=crypto.randomUUID()
 const create=(id=order,service='content-design',scope=true)=>db.query("select public.reseller_create_order($1,$2,'Design a campaign','Create an original campaign poster with licensed assets',$3)",[id,service,scope])
 const update=(version,status,note='Manually reviewed deliverable quality',url=null)=>db.query('select public.reseller_update_order($1,$2,$3,$4,$5)',[order,version,status,note,url])
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
 for(const id of [member,mod,finance]){await as(id);assert.equal((await db.query('select public.reseller_is_admin() allowed')).rows[0].allowed,false);for(const table of ['reseller_services','reseller_orders','reseller_events'])assert.equal((await db.query('select * from public.'+table)).rows.length,0);await assert.rejects(create(),/Permission denied/);await assert.rejects(update(1,'IN_PROGRESS'),/Permission denied/)}
 await as(null);await assert.rejects(db.query('select public.reseller_is_admin()'),/permission denied/)
 await as(root);assert.equal((await db.query('select count(*)::int n from public.reseller_services')).rows[0].n,4)
 for(const scope of [false,null])await assert.rejects(create(crypto.randomUUID(),'content-design',scope),/Invalid order/)
 await assert.rejects(create(crypto.randomUUID(),'fake-followers'),/Service unavailable/)
 await create();await create();assert.equal((await db.query('select * from public.reseller_orders')).rows.length,1);assert.equal((await db.query('select * from public.reseller_events')).rows.length,1)
 assert.equal(Number((await db.query('select charge_dc from public.reseller_orders')).rows[0].charge_dc),0)
 await assert.rejects(create(order,'campaign-plan'),/reference already used/)
 await assert.rejects(update(1,'COMPLETED','Content is ready','https://example.org/delivery'),/Invalid order transition/)
 await update(1,'IN_PROGRESS');await assert.rejects(update(1,'CANCELLED'),/Order changed/)
 for(const url of [null,'http://example.org/file','javascript:alert(1)','https://user:password@example.org/file','https://example.org/a b'])await assert.rejects(update(2,'COMPLETED','Delivery reviewed and ready',url),/HTTPS delivery/)
 await assert.rejects(update(2,'COMPLETED','short','https://example.org/file'),/review note/)
 await update(2,'COMPLETED','Reviewed original deliverable rights and quality','https://example.org/delivery')
 await assert.rejects(update(3,'IN_PROGRESS'),/Invalid order transition/)
 await assert.rejects(db.query("update public.reseller_orders set charge_dc=100"),/permission denied/)
 await assert.rejects(db.query('delete from public.reseller_events'),/permission denied/)
 await assert.rejects(db.query('truncate public.reseller_orders cascade'),/permission denied/)
 assert.equal((await db.query('select * from public.reseller_events')).rows.length,3)
 const cancelled=crypto.randomUUID();await create(cancelled)
 await db.query("select public.reseller_update_order($1,1,'CANCELLED','Cancelled before manual work began',null)",[cancelled])
 await assert.rejects(db.query("select public.reseller_update_order($1,2,'IN_PROGRESS','Try to restart cancelled order',null)",[cancelled]),/Invalid order transition/)
 await db.exec('reset role');await db.query("insert into public.account_restrictions(user_id,reason) values($1,'Fixture restriction')",[root]);await as(root);assert.equal((await db.query('select public.reseller_is_admin() allowed')).rows[0].allowed,false);await assert.rejects(create(crypto.randomUUID()),/Permission denied/)
 await db.exec('reset role');assert.equal(await snapshot(),before)
 const ui=await readFile('src/admin/reseller/ResellerWorkspace.jsx','utf8');assert.ok(!/functions\.invoke|api_connections|SMM_PROVIDER_API_KEY/.test(ui));assert.match(ui,/Provider not connected/)
 console.log('PASS manual reseller SQL: verified super-admin/RLS and member/moderator/finance/anonymous/restricted denial, fixed legitimate catalogue, zero-charge persistent orders, consent attestation, idempotent create, locked/versioned transitions, evidence required, terminal cancellation/completion, append-only audit, unchanged Auth/profiles/wallet/ledger; no provider calls.')
}finally{await db.close()}
