// Default: isolated PGlite workflows. POSTGRES_TEST=1 additionally runs real multi-session races.
// Optional race dependency: npm install --no-save --package-lock=false embedded-postgres@18.6.0-beta.19
import assert from 'node:assert/strict'
import {readFile,readdir,mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {PGlite} from '@electric-sql/pglite'
let db,cluster,factory
if(process.env.POSTGRES_TEST==='1'){
 const {default:EmbeddedPostgres}=await import('embedded-postgres')
 const directory=await mkdtemp(join(tmpdir(),'danqel-launch-postgres-'))
 cluster=new EmbeddedPostgres({databaseDir:directory,port:55441,user:'postgres',password:'isolated-test-only',persistent:false,onLog:()=>{},onError:()=>{},postgresFlags:['-c','listen_addresses=127.0.0.1','-c','max_connections=100']})
 await cluster.initialise();await cluster.start();const client=cluster.getPgClient();await client.connect();db={query:(...args)=>client.query(...args),exec:sql=>client.query(sql),close:()=>client.end()};factory=async()=>{const c=cluster.getPgClient();await c.connect();return c}
}else db=new PGlite()
try{await exercise()}finally{await db.close();if(cluster)await cluster.stop()}
async function exercise(){
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
 await db.exec(bootstrap);await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now(),add column raw_user_meta_data jsonb default '{}'::jsonb;alter default privileges in schema public grant all on tables to anon,authenticated")
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0],root=crypto.randomUUID(),user=crypto.randomUUID(),other=crypto.randomUUID()
 async function as(id,service=false){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(service?'service_role':id?'authenticated':'anon'))}
 for(const id of [root,user,other])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.org'])
 assert.equal(new Date((await one("select public.notification_next_time('America/New_York','02:30','2026-03-08T06:00:00Z') next")).next).toISOString(),'2026-03-08T07:30:00.000Z')
 assert.equal(new Date((await one("select public.notification_next_time('America/New_York','01:30','2026-11-01T04:00:00Z') next")).next).toISOString(),'2026-11-01T06:30:00.000Z')
 await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[root]);await db.exec("update public.push_config set public_key='fixture-public-key'")
 const pref=(push=true,daily=true,time='09:00',tz='Africa/Lagos',qs=null,qe=null,cats={})=>one('select public.notification_preferences_save($1,$2,$3,$4,$5,$6,$7)',[push,daily,time,tz,qs,qe,JSON.stringify(cats)])
 const subscribe=(endpoint='https://fcm.googleapis.com/fcm/send/fixture')=>one('select public.push_subscribe($1,$2,$3,$4) id',[endpoint,'A'.repeat(87),'B'.repeat(22),'Fixture device'])
 const claim=async()=>(await one('select public.push_claim(20) jobs')).jobs
 const finish=(job,outcome='accepted',status=201)=>one('select public.push_finish($1,$2,$3,$4,0) ok',[job.id,job.token,outcome,status])
 const inbox=async(read='',category='')=>(await one('select public.notification_inbox($1,$2,0) data',[read,category])).data
 await as(user);await one('select public.notification_preferences_get()');await assert.rejects(pref(true,true,'09:00','Invalid/Zone'),/Invalid notification/);await assert.rejects(pref(true,true,'09:00','UTC',null,null,{made_up:true}),/Invalid notification/)
 await pref();const sub=(await subscribe()).id
 await assert.rejects(subscribe('https://127.0.0.1/metadata'),/Invalid push/);await assert.rejects(subscribe('https://fcm.googleapis.com.evil.example/steal'),/Invalid push/)
 await assert.rejects(db.exec("update public.notification_preferences set push_enabled=true"),/permission denied/);await assert.rejects(db.exec('select endpoint from public.push_subscriptions'),/permission denied/)
 await assert.rejects(one('select public.push_claim(20)'),/permission denied/);await assert.rejects(one('select public.notification_tick()'),/permission denied/)
 await assert.rejects(one('select public.admin_notification_overview(0)'),/Permission denied/)
 await as(other);await assert.rejects(subscribe(),/previous account/);assert.equal((await inbox()).rows.length,0)
 await db.exec('reset role');await db.query("insert into public.notifications(user_id,title,body,category,event_key) values($1,'Private deposit update','Private finance information must not be sent to a lock screen.','deposits','deposit-test')",[user])
 await as(null,true);let jobs=await claim();assert.equal(jobs.length,1);assert.equal(jobs[0].payload.body.includes('Private finance information'),false)
 assert.equal((await finish(jobs[0],'retry',503)).ok,true);assert.equal((await finish(jobs[0])).ok,false);assert.equal((await claim()).length,0)
 await db.exec('reset role');await db.exec("update public.push_deliveries set available_at=now() where status='pending'");await as(null,true);jobs=await claim();assert.equal(jobs.length,1);assert.equal((await finish(jobs[0])).ok,true);assert.equal((await claim()).length,0)
 await as(user);assert.equal((await inbox('unread','deposits')).total,1);await one('select public.notifications_mark_read(null)');assert.equal((await inbox('unread')).total,0)
 // Time-zone scheduling, no catch-up storm and local-day idempotency.
 await db.exec('reset role');await db.query("update public.notification_preferences set next_reminder_at=now()-interval '1 minute' where user_id=$1",[user]);await as(null,true);await one('select public.notification_tick()');await one('select public.notification_tick()');await as(user);assert.equal((await inbox('','daily')).total,1)
 // Quiet hours cover the current UTC instant and defer without an HTTP attempt.
 const hour=(new Date().getUTCHours()+23)%24,end=(hour+2)%24
 await pref(true,true,'09:00','UTC',String(hour).padStart(2,'0')+':00',String(end).padStart(2,'0')+':00')
 await as(null,true);assert.equal((await claim()).length,0)
 await as(user);await pref(true,true,'09:00','UTC',null,null,{daily:false})
 await db.exec('reset role');await db.exec("update public.push_deliveries set available_at=now() where status='pending'");await as(null,true);assert.equal((await claim()).length,0)
 // A new valid message gets a gone endpoint response, disabling this device.
 await db.exec('reset role');await db.query("insert into public.notifications(user_id,title,body,category,event_key) values($1,'An app feature','A genuine feature announcement.','features','feature-gone')",[user]);await as(null,true);jobs=await claim();assert.equal(jobs.length,1);await finish(jobs[0],'gone',410)
 await as(user);assert.equal((await one('select active from public.push_subscriptions where id=$1',[sub])).active,false);await subscribe();await pref()
 await db.exec('reset role');await db.query('update auth.users set email=$2 where id=$1',[user,'changed-notification-test@example.org']);await as(user);assert.equal((await inbox('','security')).total,1)
 // Bounded fan-out, selected audience, double-tick dedup and server-only production publication.
 await as(root);const aid=crypto.randomUUID(),at=new Date().toISOString();const save=()=>one('select public.admin_notification_save($1,$2,$3,$4,$5,$6,$7,$8,$9)',[aid,'Creator event','An independently reviewed creator event announcement.','events','/notifications','selected',[user],at,'Announce a genuine special creator event'])
 await save();await save();await assert.rejects(one('select public.admin_notification_save($1,$2,$3,$4,$5,$6,$7,$8,$9)',[crypto.randomUUID(),'Fake release','This unconfirmed release must not be sent.','app_updates','/release-notes','all',[],at,'Attempt unconfirmed app release announcement']),/Valid scheduled/)
 await as(null,true);await one('select public.notification_tick()');await one('select public.notification_tick()');await as(user);assert.equal((await inbox('','events')).total,1);await as(other);assert.equal((await inbox('','events')).total,0)
 await as(root);await assert.rejects(one('select public.confirm_production_release($1,$2,$3,$4,now(),$5)',[root,'a'.repeat(40),'1.0.1','Genuine improvements and fixes.','Announce the independently confirmed production release']),/permission denied/)
 await as(null,true);const release=await one('select public.confirm_production_release($1,$2,$3,$4,now(),$5) id',[root,'a'.repeat(40),'1.0.1','Genuine improvements and fixes.','Announce the independently confirmed production release']);assert.equal((await one('select public.confirm_production_release($1,$2,$3,$4,now(),$5) id',[root,'a'.repeat(40),'1.0.1','Genuine improvements and fixes.','Announce the independently confirmed production release'])).id,release.id)
 await one('select public.notification_tick()');await as(user);assert.equal((await inbox('','app_updates')).total,1)
 // Daily cap is per message, across subscriptions; authenticated users cannot forge sends/results.
 await db.exec('reset role');await db.query("insert into public.notifications(user_id,title,body,category,event_key) select $1,'Useful update '||g,'A legitimate bounded-frequency feature announcement.','features','cap:'||g from generate_series(1,10)g",[user]);await as(null,true);jobs=await claim();assert.ok(jobs.length<=5);for(const j of jobs)await finish(j);assert.equal((await claim()).length,0)
 await as(user);await one('select public.push_unsubscribe($1)',[sub]);assert.equal((await one('select active from public.push_subscriptions where id=$1',[sub])).active,false)
 await db.exec('reset role');await assert.rejects(db.exec('delete from public.push_attempts'),/immutable|append.only/i)
 if(factory){
  await as(user);await subscribe();await pref();await db.exec('reset role');await db.exec("update public.push_deliveries set last_attempt_at=now()-interval '2 days' where status='accepted'");await db.query("insert into public.notifications(user_id,title,body,category,event_key) values($1,'Race-safe update','A real queued notification for race testing.','features','race-test')",[user])
  const session=async(sql,args=[])=>{const c=await factory();try{await c.query('set role service_role');return(await c.query(sql,args)).rows[0]}finally{await c.end()}}
  const claims=await Promise.all(Array.from({length:10},()=>session('select public.push_claim(1) jobs'))),ids=claims.flatMap(c=>c.jobs.map(j=>j.id));assert.equal(ids.length,1);assert.equal(new Set(ids).size,ids.length)
  const job=claims.flatMap(c=>c.jobs)[0];if(job){const acks=await Promise.all(Array.from({length:10},()=>session("select public.push_finish($1,$2,'accepted',201,0) ok",[job.id,job.token])));assert.equal(acks.filter(x=>x.ok).length,1)}
  console.log('PASS real PostgreSQL: competing workers never lease the same delivery; concurrent acknowledgements record one result')
 }
 // Expired leases are recoverable; stale acknowledgements cannot overwrite a newer lease.
 await as(other);await pref();await subscribe('https://fcm.googleapis.com/fcm/send/terminal-retry')
 await db.exec('reset role');await db.query("insert into public.notifications(user_id,title,body,category,event_key) values($1,'Retry boundary','A bounded retry example without external traffic.','features','terminal-retry')",[other]);await as(null,true);let retryJob=(await claim())[0];assert.ok(retryJob)
 await db.exec('reset role');await db.query("update public.push_deliveries set leased_until=now()-interval '1 minute' where id=$1",[retryJob.id]);await as(null,true);const newer=(await claim())[0];assert.equal(newer.id,retryJob.id);assert.notEqual(newer.token,retryJob.token);assert.equal((await finish(retryJob)).ok,false);retryJob=newer
 for(let attempt=2;attempt<=4;attempt++){await finish(retryJob,'retry',503);if(attempt<4){await db.exec('reset role');await db.query('update public.push_deliveries set available_at=now() where id=$1',[retryJob.id]);await as(null,true);retryJob=(await claim())[0]}}
 await db.exec('reset role');assert.equal((await one('select status from public.push_deliveries where id=$1',[retryJob.id])).status,'failed')
 await db.query('update public.profiles set is_public=true where id=any($1::uuid[])',[[user,other]]);await as(user);await one("select public.discovery_relationship($1,'connect',true)",[other]);await one("select public.discovery_relationship($1,'connect',false)",[other]);await one("select public.discovery_relationship($1,'connect',true)",[other]);await as(other);assert.equal((await inbox('','connections')).total,1);await one("select public.discovery_relationship($1,'block',true)",[user]);await as(null,true);assert.equal((await claim()).length,0)
 console.log('PASS full 001–022 notifications: preference/RLS/endpoint security, private outbox, leases/retries/410, inbox/read-all, reminders/quiet hours/dedup, selected broadcasts, release permissions, daily caps and immutable attempts. Not a live device push test.')
}
