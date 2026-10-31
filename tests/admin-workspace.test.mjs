// Isolated database acceptance, NOT real Supabase password/login acceptance.
import assert from 'node:assert/strict'
import {readFile,readdir,mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {PGlite} from '@electric-sql/pglite'
import {adminSections} from '../src/admin/sections.js'
import {resources,canView} from '../src/admin/resources.js'
assert.equal(adminSections.length,20)
for(const [,primary,children] of adminSections)for(const k of [primary,...children])assert.ok(k==='overview'||resources.some(r=>r.key===k),'Navigation resource '+k)
let db,cluster,factory
if(process.env.POSTGRES_TEST==='1'){
 const {default:EmbeddedPostgres}=await import('embedded-postgres')
 cluster=new EmbeddedPostgres({databaseDir:await mkdtemp(join(tmpdir(),'danqel-workspace-')),port:55449,user:'postgres',password:'isolated-workspace-only',persistent:false,onLog:()=>{},onError:()=>{},postgresFlags:['-c','listen_addresses=127.0.0.1']})
 await cluster.initialise();await cluster.start();const client=cluster.getPgClient();await client.connect();db={query:(...args)=>client.query(...args),exec:sql=>client.query(sql),close:()=>client.end()};factory=async(id)=>{const c=cluster.getPgClient();await c.connect();await c.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await c.query('set role authenticated');return c}
}else db=new PGlite()
try{
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
 await db.exec(bootstrap)
 await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now(),add column raw_user_meta_data jsonb default '{}'::jsonb;alter default privileges in schema public grant all on tables to anon,authenticated")
 for(const f of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())try{await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))}catch(e){throw new Error(f+': '+e.message)}
 const ids=Object.fromEntries(['root','finance','moderator','support','member','other','unverified'].map(k=>[k,crypto.randomUUID()]))
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0]
 async function as(name){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[name]||'']);await db.exec('set role '+(name?'authenticated':'anon'))}
 for(const [name,id] of Object.entries(ids))await db.query('insert into auth.users(id,email,email_confirmed_at,last_sign_in_at) values($1,$2,$3,now())',[id,name+'@example.org',name==='unverified'?null:new Date().toISOString()])
 for(const [name,role] of [['root','admin'],['finance','finance_admin'],['moderator','moderator'],['support','support_agent'],['unverified','super_admin']])await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[ids[name],role])
 await as('root');assert.equal((await one('select public.admin_role() role')).role,'super_admin')
 for(const r of resources)if(!['reward_config','reward_tasks'].includes(r.key)){
  const result=(await one('select public.admin_list($1) result',[r.key])).result;assert.ok(Array.isArray(result.rows),r.key)
 }
 const metrics=(await one('select public.admin_metrics(30) data')).data
 assert.equal(metrics.total_users,7);assert.equal(metrics.verified_users,6);assert.equal(metrics.launch_slots_remaining,50);assert.equal(metrics.registration_series.length,30);assert.equal(metrics.deposit_gross_kobo,0)
 assert.equal((await one('select public.admin_overview() data')).data.workspace_metrics.total_users,7)
 for(const tab of ['profile','social','wallet','deposits','connections','referrals','missions','support'])assert.ok((await one('select public.admin_user_detail($1,$2) data',[ids.member,tab])).data,tab)
 for(const name of ['finance','moderator','support']){await as(name);const role=(await one('select public.admin_role() role')).role;for(const r of resources)if(canView(role,r)){const result=(await one('select public.admin_list($1) result',[r.key])).result;assert.ok(Array.isArray(result.rows),name+':'+r.key)}const m=(await one('select public.admin_metrics() data')).data;assert.equal('dc_issued' in m,name==='finance');assert.equal('recent_admin_activity' in m,false)}
 await as('member');const ticket=crypto.randomUUID(),accountTicket=crypto.randomUUID();const create=(id,cat,subject='Please investigate my request')=>one('select public.create_support_ticket($1,$2,$3,$4) id',[id,subject,cat,'Detailed request body for the private support team'])
 assert.equal((await create(ticket,'payment')).id,ticket);assert.equal((await create(ticket,'payment')).id,ticket);await create(accountTicket,'account')
 await assert.rejects(create(ticket,'safety'),/unavailable/)
 await as('other');assert.equal((await db.query('select * from public.support_tickets')).rows.length,0);await assert.rejects(one('select public.support_reply($1,$2,$3)',[ticket,crypto.randomUUID(),'Cross-user reply attempt']),/unavailable/)
 await as('finance');const list=(await one("select public.admin_list('support_tickets') d")).d;assert.equal(list.total,1)
 await assert.rejects(one('select public.admin_support_thread($1)',[accountTicket]),/unavailable/)
 const request=crypto.randomUUID(),reply=()=>one('select public.admin_support_action($1,$2,$3,$4,$5)',[ticket,request,'investigating','We are reviewing your payment reference.','Reviewed disputed receiving-bank transfer reference'])
 await reply();await reply();await assert.rejects(one('select public.admin_support_action($1,$2,$3,$4,$5)',[ticket,request,'resolved','We are reviewing your payment reference.','Reviewed disputed receiving-bank transfer reference']),/unavailable/)
 await as('member');assert.equal((await db.query('select * from public.support_replies')).rows.length,1);assert.equal((await one('select status from public.support_tickets where id=$1',[ticket])).status,'investigating')
 await one('select public.support_reply($1,$2,$3)',[ticket,crypto.randomUUID(),'Here is further information on my transfer reference'])
 await as('support');assert.equal((await one("select public.admin_list('support_tickets') d")).d.total,2);assert.ok((await one('select public.admin_support_thread($1) d',[ticket])).d.replies.length===2)
 const coupon=crypto.randomUUID(),code='TEST-GIFT-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase()
 const saveCoupon=(credits=25,limit=2,active=true)=>one('select public.admin_save_coupon($1,$2,$3,$4,$5,now()+interval \'7 days\',$6)',[coupon,code,credits,limit,active,'Authorize a bounded verified account gift campaign'])
 await assert.rejects(saveCoupon(),/Permission denied/)
 await as('root');await saveCoupon();await assert.rejects(one('select public.redeem_credit_coupon($1)',[code]),/unavailable/)
 await as('unverified');assert.equal((await one('select public.admin_access() data')).data.allowed,false);await assert.rejects(one('select public.redeem_credit_coupon($1)',[code]),/Verify/)
 await as('member');const redeem=()=>one('select public.redeem_credit_coupon($1) dc',[code]);assert.equal(Number((await redeem()).dc),25);assert.equal(Number((await redeem()).dc),25);assert.equal(Number((await one('select public.dc_wallet() data')).data.balance),25)
 assert.equal((await db.query("select * from public.points_ledger where ref_key like 'coupon:%'")).rows.length,1)
 await as('root');await assert.rejects(saveCoupon(26),/retain/);await saveCoupon(25,2,false)
 await as('other');await assert.rejects(redeem(),/unavailable/)
 await as('root');await saveCoupon();await as('other');await redeem();await as('finance');await assert.rejects(redeem(),/unavailable/)
 await as('moderator');await assert.rejects(one('select public.admin_mutate($1,$2,$3,$4)', ['restrict',ids.root,{},'Prevent privileged account restriction']),/Only Super Admin/)
 await as('root');await assert.rejects(one('select public.admin_mutate($1,$2,$3,$4)',['restrict',ids.root,{},'Prevent accidental own account lockout']),/own administrative/)
 await assert.rejects(one('select public.admin_mutate($1,$2,$3,$4)',['restrict',ids.support,{},'Temporary investigation of staff account access']),/separate security review/)
 await one('select public.admin_mutate($1,$2,$3,$4)',['restrict',ids.member,{},'Temporary investigation of member account access'])
 await as('member');await assert.rejects(one('select public.create_support_ticket($1,$2,$3,$4)',[crypto.randomUUID(),'Restricted support','account','Must not bypass an account restriction']),/restricted/i)
 await as('root');await one('select public.admin_mutate($1,$2,$3,$4)',['reactivate',ids.member,{},'Investigation completed and account access cleared'])
 // A trusted fixture represents an independently restricted staff account, not a bypassable public RPC.
 await db.exec('reset role');await db.query('insert into public.account_restrictions(user_id,reason,actor_id) values($1,$2,$3)',[ids.support,'Isolated privileged security-review fixture',ids.root])
 await as('support');assert.equal((await one('select public.admin_access() d')).d.allowed,false);await assert.rejects(one('select public.admin_metrics()'),/restricted|suspended/i)
 await db.exec('reset role');await db.query('delete from public.account_restrictions where user_id=$1',[ids.support])
 // Every staff-only new endpoint rejects ordinary authenticated members, including direct requests.
 for(const name of ['member','unverified']){await as(name);for(const [sql,args] of [['select public.admin_list(\'support_tickets\')',[]],['select public.admin_metrics()',[]],['select public.admin_user_detail($1)',[ids.other]],['select public.admin_support_thread($1)',[ticket]]])await assert.rejects(one(sql,args),/Permission denied/)}
 await as('member');await assert.rejects(one('select public.admin_list_before_workspace(\'profiles\')'),/permission denied/i);await assert.rejects(one('select public.admin_mutate_before_workspace(\'adjust_points\',$1,\'{"points":100}\',\'Unauthorized mint\',gen_random_uuid())',[ids.member]),/permission denied/i)
 await assert.rejects(db.exec('truncate public.coupon_redemptions'),/permission denied|immutable/i);await assert.rejects(db.exec('delete from public.support_replies'),/permission denied/i)
 await as(null);await assert.rejects(one('select public.admin_metrics()'),/permission denied/i)
 if(factory){
  await as('root');const raceCoupon=crypto.randomUUID(),raceCode='RACE-'+crypto.randomUUID().replaceAll('-','').toUpperCase()
  await one('select public.admin_save_coupon($1,$2,37,1,true,now()+interval \'7 days\',$3)',[raceCoupon,raceCode,'Authorize a one-slot coupon race fixture'])
  const clients=await Promise.all([ids.member,ids.other,ids.finance,ids.support].map(factory))
  try{const outcomes=await Promise.allSettled(clients.map(c=>c.query('select public.redeem_credit_coupon($1)',[raceCode])));assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);await db.exec('reset role');assert.equal(Number((await one('select count(*) n from public.coupon_redemptions where coupon_id=$1',[raceCoupon])).n),1)}finally{await Promise.all(clients.map(c=>c.end()))}
  // Mutually demoting root sessions must leave one root; serialization re-checks the later actor.
  const secondRoot=crypto.randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[secondRoot,'second-root@example.org']);await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[secondRoot])
  const admins=await Promise.all([ids.root,secondRoot].map(factory));try{const outcomes=await Promise.allSettled(admins.map((c,i)=>c.query("select public.admin_mutate('set_role',$1,'{\"role\":\"user\"}','Independent authorization race test',gen_random_uuid())",[i?ids.root:secondRoot])));assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal(Number((await one("select count(*) n from public.user_roles where user_id in ($1,$2) and role in ('admin','super_admin')",[ids.root,secondRoot])).n),1)}finally{await Promise.all(admins.map(c=>c.end()))}
  console.log('PASS real PostgreSQL concurrent coupon cap and cross-root role-demotion safety; isolated, not production Auth.')
 }
 console.log('PASS admin workspace: all 20 navigation sections, all permitted resource RPCs/four roles, verified staff gates, actual metrics, all member inspector sections, private support workflow/retry/status/audit, bounded once-only coupon ledger, staff restrictions, ordinary/anonymous denial; isolated database only, NOT actual password login.')
}finally{await db.close();if(cluster)await cluster.stop()}
