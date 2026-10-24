import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
const db=new PGlite()
await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_user::text$$;
grant usage on schema auth,public to anon,authenticated,service_role;
grant execute on function auth.uid(),auth.role() to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
`)
for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()){
 const sql=(await readFile(`supabase/migrations/${file}`,'utf8')).replace('create extension if not exists pgcrypto;','')
 try{await db.exec(sql)}catch(e){throw new Error(`Migration ${file}: ${e.message}`,{cause:e})}
}
const ids={root:'10000000-0000-0000-0000-000000000001',mod:'20000000-0000-0000-0000-000000000002',finance:'30000000-0000-0000-0000-000000000003',support:'40000000-0000-0000-0000-000000000004',user:'50000000-0000-0000-0000-000000000005',other:'60000000-0000-0000-0000-000000000006'}
for(const [role,id] of Object.entries(ids)){
 await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${role}@example.com`])
 if(!['user','other'].includes(role))await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[id,{root:'super_admin',mod:'moderator',finance:'finance_admin',support:'support_agent'}[role]])
}
async function as(role){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[role?ids[role]:'']);await db.exec(`set role ${role?'authenticated':'anon'}`)}
async function rpc(sql,args=[]){return (await db.query(sql,args)).rows[0]}
const list=resource=>rpc('select public.admin_list($1) as data',[resource])
const mutate=(action,target,value={},reason='Regression test action',request=crypto.randomUUID())=>rpc('select public.admin_mutate($1,$2,$3,$4,$5)',[action,target,JSON.stringify(value),reason,request])
await as(null);await assert.rejects(list('profiles'),/permission denied/i)
await as('user');await assert.rejects(list('profiles'),/Permission denied/)
await assert.rejects(mutate('adjust_points',ids.user,{points:100}),/Permission denied/)
await as('support');await list('profiles');await assert.rejects(list('payment_transactions'),/Permission denied/);await assert.rejects(mutate('resolve_report',crypto.randomUUID()),/Permission denied/)
await as('finance');await list('payment_transactions');await assert.rejects(list('profiles'),/Permission denied/);await assert.rejects(mutate('adjust_points',ids.user,{points:1}),/Permission denied/)
await as('mod');await list('reports');await assert.rejects(list('audit_logs'),/Permission denied/)
await as('root');for(const resource of ['profiles','social_links','reports','points_ledger','points_balance','reward_tasks','reward_config','payment_transactions','subscriptions','promotions','referrals','notifications','audit_logs','user_roles','account_restrictions'])await list(resource)
await assert.rejects(list('auth.users'),/Unsupported resource/)
// Each mutation branch: atomic audit, correct scope, and expected row changes.
await db.exec('reset role')
const reportId=crypto.randomUUID(),linkId=crypto.randomUUID()
await db.query("insert into public.reports(id,reporter_id,profile_id,reason) values($1,$2,$3,'Test complaint')",[reportId,ids.other,ids.user])
await db.query("insert into public.social_links(id,profile_id,platform,url) values($1,$2,'instagram','https://instagram.com/test')",[linkId,ids.user])
await as('mod');await mutate('resolve_report',reportId)
assert.equal((await list('reports')).data.rows.find(r=>r.id===reportId).status,'resolved')
await mutate('hide_social',linkId)
assert.equal((await list('social_links')).data.rows.find(r=>r.id===linkId).is_public,false)
await assert.rejects(mutate('restrict',ids.root),/Staff restrictions/)
await as('support');await mutate('notify',ids.user,{title:'Support update',body:'Your case has been reviewed.'})
assert.equal((await list('notifications')).data.rows[0].title,'Support update')
await as('root');await mutate('set_role',ids.other,{role:'support_agent'})
assert.equal((await list('user_roles')).data.rows.find(r=>r.user_id===ids.other).role,'support_agent')
await mutate('set_role',ids.other,{role:'user'})
await mutate('configure_reward','daily_checkin_points',{value:12})
assert.equal((await list('reward_config')).data.rows.find(r=>r.key==='daily_checkin_points').value,12)
await mutate('configure_reward','daily_checkin_points',{value:10})
const task=(await list('reward_tasks')).data.rows.find(r=>r.slug==='complete-profile')
await mutate('toggle_task',task.id,{enabled:false})
assert.equal((await list('reward_tasks')).data.rows.find(r=>r.id===task.id).is_active,false)
await mutate('toggle_task',task.id,{enabled:true})
await assert.rejects(mutate('adjust_points',ids.user,{points:1},'short'),/8–1000/)
const request=crypto.randomUUID();await mutate('adjust_points',ids.user,{points:100},'Test idempotent credit',request);await mutate('adjust_points',ids.user,{points:100},'Test idempotent credit',request)
assert.equal((await list('points_balance')).data.rows.find(r=>r.user_id===ids.user).balance,100)
await assert.rejects(mutate('adjust_points',ids.user,{points:-101}),/check constraint/)
await assert.rejects(mutate('set_role',ids.root,{role:'user'}),/own role/)
await assert.rejects(db.exec("delete from public.audit_logs"),/permission denied/)
await mutate('restrict',ids.user)
await as('user');await assert.rejects(rpc('select public.claim_daily_checkin()'),/Account restricted/)
await assert.rejects(db.query("update public.profiles set bio='bypass' where id=$1",[ids.user]),/Account restricted/)
await as('root');await mutate('reactivate',ids.user)
await mutate('configure_reward','checkin_enabled',{value:0})
await as('user');await assert.rejects(rpc('select public.claim_daily_checkin()'),/paused/)
await as('root');await mutate('configure_reward','checkin_enabled',{value:1})
await as('user');await rpc('select public.claim_daily_checkin()');await assert.rejects(rpc('select public.claim_daily_checkin()'),/Already checked/)
await assert.rejects(rpc("select public.claim_task('complete-profile')"),/Complete your profile/)
await assert.rejects(rpc("select public.claim_task('daily-discover')"),/server-verified evidence/)
await db.query("update public.profiles set bio='Valid bio',country='NG',interests=array['music'],display_name='Creator' where id=$1",[ids.user])
await rpc("select public.claim_task('complete-profile')")
await assert.rejects(rpc("select public.claim_task('complete-profile')"),/Daily limit/)
assert.equal((await rpc('select balance from public.points_balance where user_id=$1',[ids.user])).balance,130)
assert.equal((await db.query('select * from public.points_balance where user_id=$1',[ids.other])).rows.length,0)
await assert.rejects(db.query("update public.profiles set is_sponsored=true where id=$1",[ids.user]),/Sponsorship requires/)
const inbox=await db.query('select * from public.notifications')
assert.equal(inbox.rows.length,1)
await db.query('update public.notifications set is_read=true where id=$1',[inbox.rows[0].id])
await assert.rejects(db.query("update public.notifications set body='forged' where id=$1",[inbox.rows[0].id]),/permission denied/)
await assert.rejects(db.query("insert into public.notifications(user_id,title) values($1,'forged')",[ids.other]),/permission denied/)
await db.query("insert into public.payment_transactions(user_id,provider,reference,amount_kobo) values($1,'paystack','test-ref',2000)",[ids.user])
await assert.rejects(rpc("select public.settle_verified_payment('test-ref',2000,'NGN','user@example.com','1')"),/permission denied/)
await db.exec('reset role')
await assert.rejects(rpc("select public.settle_verified_payment('test-ref',NULL,NULL,NULL,NULL)"),/do not match/)
await assert.rejects(rpc("select public.settle_verified_payment('test-ref',1000,'NGN','user@example.com','1')"),/do not match/)
await assert.rejects(rpc("select public.settle_verified_payment('test-ref',2000,'USD','user@example.com','1')"),/do not match/)
await assert.rejects(rpc("select public.settle_verified_payment('test-ref',2000,'NGN','other@example.com','1')"),/do not match/)
await rpc("select public.settle_verified_payment('test-ref',2000,'NGN','user@example.com','1')")
await rpc("select public.settle_verified_payment('test-ref',2000,'NGN','user@example.com','1')")
assert.equal((await rpc("select count(*)::int n from public.audit_logs where action='provider_payment_verified'")).n,1)
await as('root');
const filtered=await rpc("select public.admin_list('profiles','user_5','',0) data")
assert.equal(filtered.data.total,1)
assert.equal(filtered.data.rows[0].id,ids.user)
const emptyPage=await rpc("select public.admin_list('profiles','','',1) data")
assert.equal(emptyPage.data.rows.length,0)
assert.equal(emptyPage.data.total,6)
assert.equal((await rpc('select public.admin_overview() data')).data.revenue_kobo,2000)

// Manual payments: trusted package snapshots, evidence ownership, financial review and exactly-once credit.
await as('root')
const packageId=crypto.randomUUID()
const savePackage=(points,price)=>rpc('select public.admin_save_point_package($1,$2,$3,$4,true,$5)',[packageId,'Starter points',points,price,'Configure package for test'])
await savePackage(250,50000)
const createOrder=async(who)=>{await as(who);const id=crypto.randomUUID();await rpc('select public.create_bank_point_order($1,$2)',[packageId,id]);return id}
const orderId=await createOrder('user')
await rpc('select public.create_bank_point_order($1,$2)',[packageId,orderId])
assert.equal((await rpc('select count(*)::int n from public.bank_point_orders')).n,1)
await assert.rejects(db.query('update public.bank_point_orders set points=100000 where id=$1',[orderId]),/permission denied/)
await assert.rejects(rpc('select public.admin_save_point_package($1,$2,100,100,true,$3)',[packageId,'Forged','Forbidden package change']),/Permission denied/)
await as('root');await savePackage(500,100000)
await as('user')
const snapshot=await rpc('select * from public.bank_point_orders where id=$1',[orderId])
assert.equal(snapshot.points,250);assert.equal(snapshot.amount_kobo,50000)
assert.equal(snapshot.account_number,'6977298247')
const path=`${ids.user}/${orderId}/${crypto.randomUUID()}.png`
const submitOrder=(id,receipt,reference='user-transfer-001')=>rpc('select public.submit_bank_point_order($1,$2,$3,$4)',[id,'Test Payer',reference,receipt])
await assert.rejects(submitOrder(orderId,path),/Upload payment evidence/)
await db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),path])
await submitOrder(orderId,path);await submitOrder(orderId,path)
await assert.rejects(db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),`${ids.user}/${orderId}/${crypto.randomUUID()}.jpg`]),/row-level security/)
await db.query("delete from storage.objects where bucket_id='bank-receipts' and name=$1",[path])
assert.equal((await db.query('select * from storage.objects where name=$1',[path])).rows.length,1)
const review=(id,approve=true,bank='bank-statement-001')=>rpc('select public.admin_review_bank_order($1,$2,$3,$4)',[id,approve,bank,'Matched amount and payer against receiving bank statement'])
await assert.rejects(review(orderId),/Permission denied/)
await as('other')
assert.equal((await db.query('select * from public.bank_point_orders where id=$1',[orderId])).rows.length,0)
assert.equal((await db.query('select * from storage.objects where name=$1',[path])).rows.length,0)
await assert.rejects(submitOrder(orderId,path),/Order not found/)
await assert.rejects(db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),path]),/row-level security/)
await as('mod');await assert.rejects(review(orderId),/Permission denied/);await assert.rejects(list('bank_point_orders'),/Permission denied/)
await as('finance')
assert.equal((await db.query('select * from storage.objects where name=$1',[path])).rows.length,1)
await assert.rejects(review(orderId,true,''),/Bank statement transaction reference/)
await review(orderId);await review(orderId)
assert.equal((await list('bank_point_orders')).data.rows.find(r=>r.id===orderId).status,'approved')
await as('user');assert.equal((await rpc('select balance from public.points_balance where user_id=$1',[ids.user])).balance,380)
const second=await createOrder('user'),secondPath=`${ids.user}/${second}/${crypto.randomUUID()}.jpg`
await db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),secondPath])
await assert.rejects(submitOrder(second,secondPath,'USER-TRANSFER-001'),/unique constraint/)
await submitOrder(second,secondPath,'user-transfer-002')
await as('finance');await assert.rejects(review(second,true,'BANK-STATEMENT-001'),/unique constraint/)
await review(second,false,'');await assert.rejects(review(second),/Only submitted/)
const own=await createOrder('finance'),ownPath=`${ids.finance}/${own}/${crypto.randomUUID()}.jpg`
await db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),ownPath]);await submitOrder(own,ownPath,'finance-transfer-001')
await assert.rejects(review(own),/own payment/)
await as('root');assert.equal((await list('points_ledger')).data.rows.filter(r=>r.ref_key==='bank-order:'+orderId).length,1)
// Managed listings are not auth users and are created through the super-admin-only RPC.
const listingId=crypto.randomUUID(),listing={username:'managed_creator',display_name:'Managed Creator',bio:'Published with permission',country:'NG',interests:['music'],avatar_url:'',is_public:true,social_links:[{platform:'instagram',url:'https://instagram.com/example',is_public:true}]}
const saveListing=data=>rpc('select public.admin_save_managed_profile($1,$2,$3)',[listingId,JSON.stringify(data),'Publish creator listing with permission'])
await saveListing(listing)
assert.equal((await list('managed_profiles')).data.rows[0].username,'managed_creator')
await assert.rejects(saveListing({...listing,social_links:[{platform:'instagram',url:'javascript:alert(1)'}]}),/official HTTPS/)
await as('support');await assert.rejects(saveListing(listing),/Permission denied/)
await as(null);assert.equal((await db.query('select * from public.managed_profiles')).rows.length,1)
await as('root');await saveListing({...listing,is_public:false})
await as(null);assert.equal((await db.query('select * from public.managed_profiles')).rows.length,0)
await as('user');await assert.rejects(db.query("insert into storage.objects(id,bucket_id,name) values($1,'avatars',$2)",[crypto.randomUUID(),`${ids.other}/forged.png`]),/row-level security/)
await db.query("insert into storage.objects(id,bucket_id,name) values($1,'avatars',$2)",[crypto.randomUUID(),`${ids.user}/photo.png`])
await assert.rejects(db.query("update storage.objects set bucket_id='bank-receipts' where bucket_id='avatars'"),/row-level security/)
await as('root')
const bankOverview=(await rpc('select public.admin_overview() data')).data
assert.equal(bankOverview.bank_revenue_kobo,50000)
assert.equal(bankOverview.pending_bank_orders,1)
console.log('Manual bank payment snapshots, evidence RLS, approval idempotency, duplicate references, package configuration and managed listings passed')


// Member programmes: backend controls, genuine directory, referrals and capped boosters.
await as('root')
for(const resource of ['site_settings','bank_transfer_details','boost_plans','user_boosts','referral_purchase_rewards'])await list(resource)
const config={brand_name:'Test community',hero_title:'Real connections',hero_description:'A community powered by real members.',maintenance_mode:false,enabled_platforms:['whatsapp','instagram'],support_email:'help@example.org'}
const saveSite=data=>rpc('select public.admin_save_site_settings($1,$2)',[JSON.stringify(data),'Configure member site for regression testing'])
await saveSite(config)
await assert.rejects(mutate('configure_reward','referral_purchase_percent',{value:51}),/0–50/)
await mutate('configure_reward','referral_purchase_percent',{value:20})
await as('user')
const mine=(await rpc('select public.member_overview() data')).data
assert.equal(mine.balance.balance,380)
assert.ok(mine.balance.referral_code)
await assert.rejects(rpc('select public.admin_save_site_settings($1,$2)',[JSON.stringify(config),'Unauthorized attempt']),/Permission denied/)
await assert.rejects(db.query("insert into public.social_links(profile_id,platform,url) values($1,'tiktok','https://tiktok.com/@test')",[ids.user]),/not currently available/)
await assert.rejects(rpc('select public.consume_boost_bonus(1000)'),/permission denied/)
await assert.rejects(db.query("insert into public.social_links(profile_id,platform,url,is_public) values($1,'instagram','https://evil.example/test',true)",[ids.user]),/official HTTPS/)

await as('other');await rpc('select public.member_overview()')
await assert.rejects(rpc('select public.apply_referral($1)',[(await rpc('select public.member_overview() data')).data.balance.referral_code]),/Invalid referral/)
await rpc('select public.apply_referral($1)',[mine.balance.referral_code])
await assert.rejects(rpc('select public.apply_referral($1)',[mine.balance.referral_code]),/unique constraint/)
const referredOrder=await createOrder('other'),refReceipt=`${ids.other}/${referredOrder}/${crypto.randomUUID()}.png`
await db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),refReceipt]);await submitOrder(referredOrder,refReceipt,'referral-transfer-001')
await as('finance');await review(referredOrder,true,'bank-referral-001');await review(referredOrder,true,'bank-referral-001')
await as('user')
assert.equal((await rpc('select public.member_overview() data')).data.balance.balance,480)
assert.equal((await rpc('select public.member_referrals(0) data')).data.rows[0].purchase_reward_points,100)
assert.equal((await db.query('select * from public.referral_purchase_rewards')).rows.length,1)
await as('root')
const planId=crypto.randomUUID(),plan={title:'Bounded booster',cost_points:50,multiplier:3,duration_hours:24,bonus_cap:25,is_active:true}
const saveBoost=data=>rpc('select public.admin_save_boost_plan($1,$2,$3)',[planId,JSON.stringify(data),'Configure bounded test booster'])
await saveBoost(plan)
await as('user')
await as('other')
const activation=crypto.randomUUID()
await rpc('select public.activate_point_boost($1,$2)',[planId,activation]);await rpc('select public.activate_point_boost($1,$2)',[planId,activation])
assert.equal((await rpc('select public.member_overview() data')).data.balance.balance,450)
await assert.rejects(rpc('select public.activate_point_boost($1,$2)',[planId,crypto.randomUUID()]),/already have an active/)
await as('root');await saveBoost({...plan,multiplier:5,cost_points:100})
await as('other');await rpc('select public.claim_daily_checkin()')
let overview=(await rpc('select public.member_overview() data')).data
assert.equal(overview.balance.balance,480) // 10 base + 20 bonus
assert.equal(overview.active_boost.multiplier,3) // existing plan snapshot unchanged
assert.equal(overview.active_boost.bonus_used,20)
await assert.rejects(rpc('select public.claim_daily_checkin()'),/Already checked/)
await db.query("update public.profiles set bio='Valid creator bio',country='NG',interests=array['music'],display_name='Another Creator' where id=$1",[ids.other])
await rpc("select public.claim_task('complete-profile')")
overview=(await rpc('select public.member_overview() data')).data
assert.equal(overview.balance.balance,505) // base 20 + only 5 bonus remaining
assert.equal(overview.active_boost.bonus_used,25)
await db.exec('reset role');await db.query("update public.user_boosts set expires_at=now()-interval '1 second' where id=$1",[activation])
await as('other');await db.query("insert into public.social_links(profile_id,platform,url,is_public) values($1,'instagram','https://instagram.com/test',true)",[ids.other])
await rpc("select public.claim_task('add-social-link')")
assert.equal((await rpc('select public.member_overview() data')).data.balance.balance,520)
await as('support');await assert.rejects(saveBoost(plan),/Permission denied/)
await as('root');await saveSite({...config,maintenance_mode:true})
await as('user');await assert.rejects(rpc("select public.claim_task('complete-profile')"),/maintenance/)
await assert.rejects(rpc('select public.activate_point_boost($1,$2)',[planId,crypto.randomUUID()]),/maintenance/)
await assert.rejects(db.query("update public.profiles set bio='Paused change' where id=$1",[ids.user]),/maintenance/)
await as('root');await saveSite(config)
await as(null)
const directory=(await rpc("select public.public_directory('','','','',0) data")).data
assert.equal(directory.total,6)
assert.equal(directory.rows.length,6)
assert.ok(directory.rows.every(p=>!p.managed)) // private managed listing was not leaked
assert.ok(directory.rows.every(p=>!p.display_name.includes('(Demo)')))
assert.equal((await rpc("select public.public_directory('user_5','','','',0) data")).data.total,1)
await assert.rejects(rpc('select public.member_overview()'),/permission denied/)
await as('root')
console.log('Member site controls, referral purchase rewards, directory privacy and booster snapshots/caps/expiry/idempotency passed')

await db.close();console.log('Admin migrations, permissions, restrictions, rewards, audit and payment reconciliation tests passed')
