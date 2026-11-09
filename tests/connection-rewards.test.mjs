import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
const db=new PGlite()
try{
 const boot=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1];await db.exec(boot)
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()')
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort())await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;',''))
 await db.exec(await readFile('supabase/manual/install_manual_bank_transfers.sql','utf8'))
 await db.exec(await readFile('supabase/manual/install_paid_feed_listings.sql','utf8'))
 const actor=crypto.randomUUID(),other=crypto.randomUUID(),targets=Array.from({length:54},()=>crypto.randomUUID())
 for(const [i,id] of [actor,other,...targets].entries()){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.org'])
  await db.query("update public.profiles set username=$2,display_name='Listed member',is_public=true where id=$1",[id,'reward_member_'+i])
  await db.query("insert into public.social_links(profile_id,platform,url,is_public) values($1,'instagram','https://instagram.com/member',true)",[id])
 }
 await db.query('insert into public.points_balance(user_id,balance) values($1,27)',[actor]);await db.query("insert into public.points_ledger(user_id,points,reason,ref_key) values($1,27,'Existing reward','existing-reward')",[actor])
 // Explicit isolated fixtures, not live purchases: paid checkout itself has its own real-RPC suite.
 for(const id of targets)await db.query("insert into public.feed_listing_orders(id,user_id,package_key,cost_dc,duration_hours,starts_at,ends_at) values($1,$2,'1d',2400,24,now()-interval '1 hour',now()+interval '23 hours')",[crypto.randomUUID(),id])
 const snapshot=async()=>JSON.stringify(await Promise.all(['auth.users','profiles','points_balance','points_ledger','bank_point_orders','audit_logs','notifications','feed_listing_orders','blocks','favourites'].map(async t=>(await db.query('select * from '+t+' order by 1')).rows)))
 const original=await snapshot();await db.exec(await readFile('supabase/manual/install_connection_rewards.sql','utf8'));assert.equal(await snapshot(),original,'Installation changes no existing rows')
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
 const act=async(id,action='connect',enabled=true)=>(await db.query('select public.discovery_relationship($1,$2,$3) data',[id,action,enabled])).rows[0].data
 const list=async(kind='connected',page=0)=>(await db.query('select public.discovery_connections($1,$2) data',[kind,page])).rows[0].data
 const own=async()=>(await db.query('select balance from public.points_balance')).rows[0]?.balance
 await as(null);await assert.rejects(act(targets[0]),/permission denied/);await assert.rejects(list(),/permission denied/)
 await as(actor);await assert.rejects(act(actor),/Invalid/);await assert.rejects(act(other),/unavailable/);await assert.rejects(act(targets[0],'fake'),/Invalid/);await assert.rejects(act(targets[0],'connect',null),/Invalid/)
 assert.equal((await act(targets[0],'save')).reward_dc,0);assert.equal(await own(),27)
 const first=await act(targets[0]);assert.equal(first.reward_dc,7);assert.equal(first.rewarded_today,1);assert.equal(await own(),34)
 assert.equal((await act(targets[0])).reward_dc,0);await act(targets[0],'connect',false);assert.equal((await act(targets[0])).reward_dc,0);assert.equal(await own(),34)
 const directory=(await db.query("select public.public_directory('reward_member_2') data")).rows[0].data;assert.equal(directory.feed_policy,'purchased_dc_v1');assert.equal(directory.rows.find(r=>r.id===targets[0]).is_connected,true);assert.equal(directory.rows.find(r=>r.id===targets[0]).is_saved,true)
 assert.equal((await list()).rows[0].profile.is_connected,true);assert.equal((await list('saved')).total,1)
 for(const sql of ["insert into public.member_connections(user_id,profile_id) values('"+actor+"','"+targets[1]+"')",'update public.member_connections set created_at=now()','delete from public.member_connections','truncate public.member_connections','update public.connection_reward_events set reward_dc=7','delete from public.connection_reward_events','truncate public.connection_reward_events',"insert into public.blocks(blocker_id,blocked_id) values('"+actor+"','"+other+"')",'update public.points_balance set balance=1000000'])await assert.rejects(db.exec(sql),/permission denied/)
 for(const target of targets.slice(1,50))assert.equal((await act(target)).reward_dc,7)
 const cap=await act(targets[50]);assert.equal(cap.reward_dc,0);assert.equal(cap.reward_status,'daily_cap');assert.equal(cap.rewarded_today,50);assert.equal(await own(),377);assert.equal((await list()).total,51);assert.equal((await list('connected',1)).rows.length,12)
 await act(targets[50],'connect',false);assert.equal((await act(targets[50])).reward_status,'already_processed');assert.equal(await own(),377)
 assert.equal((await db.query('select public.my_feed_listing() data')).rows[0].data.purchased_dc,0);await assert.rejects(db.query("select public.buy_feed_listing('7h',$1,1200,7)",[crypto.randomUUID()]),/Not enough purchased DC/)
 // Block removes both directions and favourites but NEVER the financial dedup record.
 await as(targets[0]);await act(actor,'block');await as(actor);assert.equal((await list()).total,50);assert.equal((await list('saved')).total,0);await assert.rejects(act(targets[0]),/unavailable/)
 await as(targets[0]);await act(actor,'block',false);await as(actor);assert.equal((await act(targets[0])).reward_dc,0)
 // UTC accounting is independent of session timezone, and yesterday's awards don't consume today.
 await db.exec('reset role');await db.exec("set timezone='Pacific/Honolulu'")
 for(let i=0;i<50;i++)await db.query("insert into public.connection_reward_events values($1,$2,7,'granted',(now() at time zone 'UTC')::date-1,((now() at time zone 'UTC')::date-1)::timestamp at time zone 'UTC')",[other,crypto.randomUUID()])
 await as(other);assert.equal((await act(targets[0])).rewarded_today,1);assert.equal(await own(),7);assert.equal((await db.query('select * from public.connection_reward_events')).rows.length,51);assert.equal((await list()).total,1)
 await db.exec('reset role');await db.query("insert into public.account_restrictions(user_id,reason,actor_id) values($1,'Restricted fixture',$2)",[other,actor]);await as(other);await assert.rejects(act(targets[1]),/restricted/);await db.exec('reset role');await db.query('delete from public.account_restrictions where user_id=$1',[other]);await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[other]);await as(other);await assert.rejects(act(targets[1]),/restricted/);await db.exec('reset role');await db.query('update auth.users set banned_until=null where id=$1',[other])
 // Deliberately fail the last write: relationship, event, ledger and wallet must all roll back.
 await db.exec("create function public.fixture_audit_failure() returns trigger language plpgsql as $$begin raise exception 'Fixture audit failure';end$$;create trigger fixture_failure before insert on public.audit_logs for each row execute function public.fixture_audit_failure()")
 await as(other);await assert.rejects(act(targets[1]),/Fixture audit failure/);assert.equal(await own(),7);assert.equal((await list()).total,1);assert.equal((await db.query('select * from public.connection_reward_events where profile_id=$1',[targets[1]])).rows.length,0)
 await db.exec('reset role');await db.exec('drop trigger fixture_failure on public.audit_logs;drop function public.fixture_audit_failure()');await as(other);assert.equal((await act(targets[1])).reward_dc,7);assert.equal(await own(),14)
 await assert.rejects(list('invalid'),/Invalid/);await assert.rejects(list('connected',-1),/Invalid/)
 await db.exec('reset role');for(const sql of ['update public.connection_reward_events set reward_dc=0','delete from public.connection_reward_events','truncate public.connection_reward_events'])await assert.rejects(db.exec(sql),/append-only/)
 assert.equal((await db.query("select count(*)::int n from public.points_ledger where user_id=$1 and ref_key like 'connection-reward:%'",[actor])).rows[0].n,50)
 await db.query("update public.feed_listing_orders set starts_at=starts_at-interval '40 days',ends_at=ends_at-interval '40 days' where user_id=$1",[targets[53]]);await as(other);await assert.rejects(act(targets[53]),/unavailable/)
 await db.exec('reset role');await db.query("update public.profiles set is_public=false where id=$1",[targets[52]]);await as(other);await assert.rejects(act(targets[52]),/unavailable/)
 await db.exec('reset role');await db.query('update public.connection_reward_settings set enabled=false');await as(other);const paused=await act(targets[51]);assert.equal(paused.reward_dc,0);assert.equal(paused.reward_status,'paused');assert.equal((await list()).total,3)
 console.log('PASS targeted connection reward SQL: original-row preservation, 7 DC atomic grant, 50/day UTC cap, free cap overflow, permanent dedup, reconnect/block safety, no self/save/block/private/unlisted/expired/restricted/banned rewards, owner-only reads, no client writes, purchased exclusion, append-only history, rollback on final audit failure. Isolated PGlite is not production concurrency proof.')
}finally{await db.close()}
