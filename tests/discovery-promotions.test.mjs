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
 cluster=new EmbeddedPostgres({databaseDir:directory,port:55439,user:'postgres',password:'isolated-test-only',persistent:false,onLog:()=>{},onError:()=>{},postgresFlags:['-c','listen_addresses=127.0.0.1','-c','max_connections=100']})
 await cluster.initialise();await cluster.start();const client=cluster.getPgClient();await client.connect();db={query:(...args)=>client.query(...args),exec:sql=>client.query(sql),close:()=>client.end()};factory=async()=>{const c=cluster.getPgClient();await c.connect();return c}
}else db=new PGlite()
try{await exercise()}finally{await db.close();if(cluster)await cluster.stop()}
async function exercise(){
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
 await db.exec(bootstrap);await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now(),add column raw_user_meta_data jsonb default '{}'::jsonb;alter default privileges in schema public grant all on tables to anon,authenticated")
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&parseInt(f)<=21).sort()) {console.log('Applying',f);await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))}
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0]
 const root=crypto.randomUUID(),user=crypto.randomUUID(),other=crypto.randomUUID(),poor=crypto.randomUUID()
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
 for(const id of [root,user,other,poor]){await db.query('insert into auth.users(id,email,email_confirmed_at,last_sign_in_at) values($1,$2,now(),now())',[id,id+'@example.org']);await db.query("update public.profiles set username=$2,display_name='Useful Creator',bio='Original educational creator work',country='NG',interests=array['education'],avatar_url='https://example.org/portrait.png',is_public=true where id=$1",[id,'c_'+id.replaceAll('-','').slice(0,18)])}
 await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[root])
 const products=(await db.query('select * from public.dc_products where promotion_kind is not null')).rows,product=kind=>products.find(p=>p.promotion_kind===kind)
 assert.equal(products.length,5);assert.deepEqual(['spotlight','visibility','featured','social','badge'].map(k=>Number(product(k).cost_dc)),[500,800,1000,1500,400])
 const balance=async()=>Number((await one('select public.dc_wallet() data')).data.balance)
 const history=async(status='')=>(await one('select public.my_promotion_campaigns($1,0) data',[status])).data
 const directory=async()=>(await one("select public.public_directory('','','','',0) data")).data
 const buy=(kind,id=crypto.randomUUID())=>one('select public.buy_promotion($1,$2,$3,$4,$5) id',[product(kind).id,id,'Promote my original educational creator profile',product(kind).cost_dc,product(kind).duration_hours])
 const review=(id,action)=>one('select public.admin_review_promotion($1,$2,$3)',[id,action,'Independent promotional content moderation review'])
 const relation=(id,action,on=true)=>one('select public.discovery_relationship($1,$2,$3)',[id,action,on])
 await as(user);assert.equal(await balance(),5000)
 assert.equal((await one("select public.public_directory('','instagram','','',0) data")).data.total,0)
 assert.equal((await one("select public.public_directory('','','ZZ','',0) data")).data.total,0)
 assert.equal((await one("select public.public_directory('','','','education',0) data")).data.total,4)
 const baseline=(await one('select count(*)::int n from public.points_ledger')).n
 await relation(other,'connect');await relation(other,'connect');await relation(other,'save');assert.equal((await one("select public.discovery_connections('connected',0) data")).data.total,1)
 await as(other);await relation(user,'connect');await relation(user,'save');await relation(user,'block')
 assert.equal((await one('select count(*)::int n from public.profiles where id=$1',[user])).n,0)
 await as(user);assert.equal((await one('select count(*)::int n from public.profiles where id=$1',[other])).n,0);await assert.rejects(relation(other,'connect'),/unavailable or blocked/)
 assert.equal((await one("select public.discovery_connections('connected',0) data")).data.total,0)
 await as(other);await relation(user,'block',false);await as(user);assert.equal(await balance(),5000);assert.equal((await one('select count(*)::int n from public.points_ledger')).n,baseline)
 await assert.rejects(db.query('insert into public.favourites(user_id,profile_id) values($1,$2)',[user,other]),/permission denied/)
 await assert.rejects(db.exec("update public.dc_products set cost_dc=1"),/permission denied/)
 await assert.rejects(one('select public.dc_spend_before_promotions($1,$2,$3)',[product('badge').id,crypto.randomUUID(),'Bypass moderation']),/permission denied/)
 const id=crypto.randomUUID();assert.equal((await buy('spotlight',id)).id,id);assert.equal((await buy('spotlight',id)).id,id);assert.equal(await balance(),4500)
 await assert.rejects(buy('spotlight'),/already pending or running/);await assert.rejects(review(id,'approve'),/Permission denied/)
 assert.equal((await history()).rows[0].effective_status,'pending');assert.equal((await directory()).paid_rows.length,0)
 await as(root);await review(id,'approve');await review(id,'approve');let campaign=await one('select * from public.promotion_campaigns where id=$1',[id]);assert.equal((new Date(campaign.ends_at)-new Date(campaign.starts_at))/3600000,24)
 await one('select public.admin_save_promotion_package($1,700,72,true,$2,$3)',[product('spotlight').id,'A clearly labelled paid Spotlight placement.','Change catalogue for future purchases only'])
 await as(user);await assert.rejects(buy('spotlight'),/Package changed/);product('spotlight').cost_dc=700;product('spotlight').duration_hours=72;await as(root);await review(id,'pause');assert.equal((await directory()).paid_rows.length,0);await review(id,'resume');assert.equal((await one('select ends_at from public.promotion_campaigns where id=$1',[id])).ends_at.toString(),campaign.ends_at.toString())
 await as(other);assert.equal((await directory()).paid_rows.length,1);assert.equal((await directory()).rows.find(p=>p.id===user).is_sponsored,false)
 await db.exec('reset role');await db.query("insert into public.social_links(profile_id,platform,url,is_public) values($1,'instagram','https://instagram.com/creator',true)",[user]);await as(other)
 for(let i=0;i<3;i++)await one("select public.record_promotion_event($1,$2,'profile_open','')",[id,user])
 await one("select public.record_promotion_event($1,$2,'social_open','instagram')",[id,user]);assert.equal((await one("select public.record_promotion_event($1,$2,'social_open','tiktok') ok",[id,user])).ok,false)
 await relation(user,'block');assert.equal((await directory()).paid_rows.length,0);assert.equal((await one('select count(*)::int n from public.social_links where profile_id=$1',[user])).n,0);await relation(user,'block',false)
 await as(user);let h=(await history()).rows[0];assert.equal(h.recorded_profile_opens,1);assert.equal(h.recorded_social_opens,1);assert.equal(Number(h.cost_dc),500);assert.equal(h.duration_hours,24)
 assert.equal((await one("select public.record_promotion_event($1,$2,'profile_open','') ok",[id,user])).ok,false)
 await as(root);await review(id,'reject');await review(id,'reject');await as(user);assert.equal(await balance(),5000);assert.equal((await history('rejected')).total,1)
 const pending=(await buy('visibility')).id;await as(root);await review(pending,'reject');await review(pending,'reject');await as(user);assert.equal(await balance(),5000)
 const badge=(await buy('badge')).id;await as(root);await review(badge,'approve');await as(other);const username='c_'+user.replaceAll('-','').slice(0,18);assert.equal((await one('select public.discovery_profile($1,false) data',[username])).data.paid_premium_badge,true)
 await db.exec('reset role');await db.query("update public.promotion_campaigns set starts_at=now()-interval '31 days',ends_at=now()-interval '1 day' where id=$1",[badge]);await as(user);assert.equal((await history('expired')).total,1)
 await as(root);await assert.rejects(review(badge,'resume'),/expired/);await as(other);assert.equal((await one('select public.discovery_profile($1,false) data',[username])).data.paid_premium_badge,false)
 await as(poor);await buy('social');await buy('featured');await buy('visibility');await buy('spotlight');await buy('badge');assert.equal(await balance(),600);await assert.rejects(buy('visibility'),/already pending/)
 // Another complete public account with a zero wallet cannot buy; no partial order/campaign survives.
 await db.exec('reset role');const empty=crypto.randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[empty,empty+'@example.org']);await db.query("update public.launch_campaign set is_active=false");await db.query("update public.profiles set display_name='Eligible Empty',bio='Original useful educational work',country='NG',interests=array['education'],avatar_url='https://example.org/avatar.png',is_public=true where id=$1",[empty]);await as(empty);await assert.rejects(buy('badge'),/Not enough points/i);assert.equal((await history()).total,0)
 await as(root);const own=(await buy('badge')).id;await assert.rejects(review(own,'approve'),/Another administrator/)
 await as(user);await assert.rejects(one("select public.admin_list('promotion_campaigns','','',0)"),/Permission denied/);assert.equal((await one('select count(*)::int n from public.promotion_campaigns')).n,3)
 await as(user);await assert.rejects(one('select public.admin_save_promotion_package($1,1,1,true,$2,$3)',[product('badge').id,'Untrusted changed description','Untrusted price change attempt']),/Permission denied/)
 await assert.rejects(db.query("insert into public.reports(reporter_id,profile_id,reason,status) values($1,$2,'Suspicious account content','resolved')",[user,other]),/permission denied/)
 await db.query("insert into public.reports(reporter_id,profile_id,reason) values($1,$2,'Suspicious account content')",[user,other])
 await assert.rejects(db.query("insert into public.reports(reporter_id,profile_id,reason) values($1,$2,'No')",[user,other]),/row-level security/)
 await as(null);await assert.rejects(buy('badge'),/permission denied/)
 if(factory){
  const session=async(id,sql,args)=>{const c=await factory();try{await c.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await c.query('set role authenticated');return (await c.query(sql,args)).rows[0]}finally{await c.end()}}
  await as(root);for(const p of products)await one('select public.admin_save_promotion_package($1,2000,24,true,$2,$3)',[p.id,'Clearly labelled paid placement for a fixed window.','Configure isolated financial race fixture packages'])
  const requests=Array.from({length:20},()=>crypto.randomUUID()),details='Concurrent reviewed creator promotion'
  const buys=await Promise.allSettled(requests.map(id=>session(other,'select public.buy_promotion($1,$2,$3,2000,24) id',[product('spotlight').id,id,details])))
  assert.equal(buys.filter(r=>r.status==='fulfilled').length,1);const won=buys.find(r=>r.status==='fulfilled').value.id
  const retries=await Promise.all(Array.from({length:20},()=>session(other,'select public.buy_promotion($1,$2,$3,2000,24) id',[product('spotlight').id,won,details])));assert.ok(retries.every(r=>r.id===won))
  await as(other);assert.equal(await balance(),3000)
  await Promise.all(Array.from({length:20},()=>session(root,"select public.admin_review_promotion($1,'reject','Independently reject unsuitable promotion content')",[won])));await as(other);assert.equal(await balance(),5000)
  const varied=await Promise.allSettled(products.map(p=>session(other,'select public.buy_promotion($1,$2,$3,2000,24) id',[p.id,crypto.randomUUID(),details])))
  assert.equal(varied.filter(r=>r.status==='fulfilled').length,2);assert.ok(varied.filter(r=>r.status==='rejected').every(r=>/Not enough points/.test(r.reason.message)))
  await as(other);assert.equal(await balance(),1000)
  console.log('PASS: real PostgreSQL 20 simultaneous same-kind requests, 20 identical retries, 20 concurrent refunds, and competing different-kind purchases cannot overspend')
 }
 await db.exec('reset role');await db.query('update public.profiles set is_public=false where id=$1',[user]);await as(other);assert.equal((await one('select count(*)::int n from public.profiles where id=$1',[user])).n,0);assert.equal((await one('select public.discovery_profile($1,false) data',['c_'+user.replaceAll('-','').slice(0,18)])).data,null)
 await as(null);assert.equal((await directory()).rows.some(p=>p.id===user),false)
 await as(user);assert.equal(Number((await one('select creator_xp from public.profiles where id=$1',[user])).creator_xp),0)
 await db.exec('reset role');await assert.rejects(db.exec('delete from public.promotion_events'),/immutable|append.only/i)
 console.log('PASS: full 001–020 migrations, free relationships/blocks/RLS, purchases/retries/insufficiency, independent approvals, snapshot edits, pause/resume/expiry, exactly-once refunds, paid-vs-organic, deduplicated actual telemetry, cosmetic badge and denied financial writes')
}
