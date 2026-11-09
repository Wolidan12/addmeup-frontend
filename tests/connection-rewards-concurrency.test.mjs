// Opt-in REAL PostgreSQL test against a dedicated local disposable cluster, never Supabase.
import {Client,Pool} from 'pg'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
const socket='/home/user/.cache/connection-reward-postgres'
if(process.env.CONNECTION_TEST_SOCKET!==socket)throw new Error('Use the dedicated disposable connection-reward-postgres Unix socket; remote or production databases are not supported.')
const config={host:socket,port:55432,user:'postgres'},name='danqel_connection_test_'+crypto.randomUUID().replaceAll('-',''),admin=new Client({...config,database:'postgres'})
let db,pool,created=false
try{
 await admin.connect()
 assert.equal((await admin.query("select count(*)::int n from pg_database where datname not in ('postgres','template0','template1') and datname not like 'danqel_connection_test_%'")).rows[0].n,0,'Refuse a non-disposable cluster')
 await admin.query('create database '+name);created=true;db=new Client({...config,database:name});await db.connect()
 let boot=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
 boot=boot.replace(/create role (anon|authenticated|service_role);/g,(_,role)=>`do $$begin create role ${role};exception when duplicate_object then null;end$$;`)
 await db.query(boot);await db.query('alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()')
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort())await db.query((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;',''))
 for(const file of ['install_manual_bank_transfers.sql','install_paid_feed_listings.sql','install_connection_rewards.sql'])await db.query(await readFile('supabase/manual/'+file,'utf8'))
 const actors=[crypto.randomUUID(),crypto.randomUUID()],targets=Array.from({length:51},()=>crypto.randomUUID())
 for(const [i,id] of [...actors,...targets].entries()){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.org']);await db.query("update public.profiles set username=$2,display_name='Concurrent listed member',is_public=true where id=$1",[id,'concurrent_'+i]);await db.query("insert into public.social_links(profile_id,platform,url,is_public) values($1,'instagram','https://instagram.com/member',true)",[id])
 }
 await db.query('insert into public.points_balance(user_id,balance) values($1,90)',[actors[0]])
 await db.query("insert into public.points_ledger(user_id,points,reason,ref_key) values($1,90,'Existing reward','existing-reward')",[actors[0]])
 for(const id of targets)await db.query("insert into public.feed_listing_orders(id,user_id,package_key,cost_dc,duration_hours,starts_at,ends_at) values($1,$2,'1d',2400,24,now()-interval '1 hour',now()+interval '23 hours')",[crypto.randomUUID(),id])
 pool=new Pool({...config,database:name,max:16})
 async function act(user,target,action='connect',enabled=true){const c=await pool.connect();try{await c.query('begin');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);await c.query('set local role authenticated');const {rows}=await c.query('select public.discovery_relationship($1,$2,$3) data',[target,action,enabled]);await c.query('commit');return rows[0].data}catch(e){await c.query('rollback');throw e}finally{c.release()}}
 // Deliberately queue concurrent different-pair grants behind the ORIGINAL wallet row.
 await db.query('begin');await db.query('select * from public.points_balance where user_id=$1 for update',[actors[0]])
 const requests=actors.flatMap(actor=>[...targets,...Array(20).fill(targets[0])].map(target=>act(actor,target)))
 await new Promise(r=>setTimeout(r,150));await db.query('commit')
 const results=await Promise.all(requests)
 assert.equal(results.filter(r=>r.reward_dc===7).length,100);assert.equal(results.reduce((sum,r)=>sum+r.reward_dc,0),700)
 for(const [i,actor] of actors.entries()){
  assert.equal((await db.query('select balance from public.points_balance where user_id=$1',[actor])).rows[0].balance,i===0?440:350)
  assert.equal((await db.query('select count(*)::int n from public.member_connections where user_id=$1',[actor])).rows[0].n,51)
  assert.equal((await db.query('select count(*)::int n from public.connection_reward_events where user_id=$1 and reward_dc=7',[actor])).rows[0].n,50)
  assert.equal((await db.query('select count(*)::int n from public.connection_reward_events where user_id=$1 and reward_dc=0',[actor])).rows[0].n,1)
  assert.equal((await db.query("select count(*)::int n from public.points_ledger where user_id=$1 and ref_key like 'connection-reward:%'",[actor])).rows[0].n,50)
  assert.equal(Number((await db.query('select public.feed_purchased_dc($1) n',[actor])).rows[0].n),0)
 }
 // A simultaneous reciprocal block/connect cannot leave a connection across a block.
 const race=await Promise.allSettled([act(targets[0],actors[0],'block'),act(actors[0],targets[0])]);assert.equal(race[0].status,'fulfilled')
 if(race[1].status==='rejected')assert.match(race[1].reason.message,/unavailable/)
 assert.equal((await db.query('select count(*)::int n from public.member_connections where user_id=$1 and profile_id=$2',[actors[0],targets[0]])).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int n from public.connection_reward_events where reward_dc=7')).rows[0].n,100)
 console.log('PASS real local PostgreSQL concurrency: 142 simultaneous requests / 2 actors / 16 sessions, exactly 50×7 DC each, original 90 DC preserved, atomic first-wallet initialization, one free over-cap connection each, duplicate-pair dedup, separate purchased balance, reciprocal block/connect serialization. Disposable Unix-socket cluster only; not production acceptance.')
}finally{
 if(pool)await pool.end();if(db)await db.end();if(created)await admin.query('drop database '+name);await admin.end()
}
