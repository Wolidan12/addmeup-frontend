import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {feedListingPackages} from '../src/lib/feedListingPackages.js'
const db=new PGlite()
try{
 const boot=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1];await db.exec(boot)
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()')
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort())await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;',''))
 const finance=crypto.randomUUID(),buyer=crypto.randomUUID(),reward=crypto.randomUUID(),other=crypto.randomUUID()
 for(const [i,id] of [finance,buyer,reward,other].entries()){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.org'])
  await db.query("update public.profiles set username=$2,display_name='Simple member',is_public=true where id=$1",[id,'member_'+i])
  await db.query("insert into public.social_links(profile_id,platform,url,is_public) values($1,'instagram','https://instagram.com/member',true)",[id])
  await db.query('insert into public.points_balance(user_id,balance) values($1,$2)',[id,id===buyer?90:id===reward?100000:0])
 }
 await db.query("insert into public.points_ledger(user_id,points,reason,ref_key) values($1,100000,'Reward only','reward-only'),($2,90,'Existing reward','opening-reward')",[reward,buyer])
 await db.query("insert into public.user_roles(user_id,role) values($1,'finance_admin')",[finance])
 await db.query("insert into public.managed_profiles(username,display_name,is_public,created_by) values('managed_demo','Managed example',true,$1)",[finance])
 await db.exec(await readFile('supabase/manual/install_manual_bank_transfers.sql','utf8'))
 const snapshot=async()=>JSON.stringify(await Promise.all(['auth.users','public.profiles','public.managed_profiles','public.points_balance','public.points_ledger','public.bank_point_orders','public.audit_logs','public.notifications'].map(async table=>(await db.query('select * from '+table+' order by 1')).rows)))
 const before=await snapshot();await db.exec(await readFile('supabase/manual/install_paid_feed_listings.sql','utf8'));assert.equal(await snapshot(),before,'Installation preserves all original rows')
 const packages=(await db.query('select key,duration_hours,cost_dc from public.feed_listing_packages order by duration_hours')).rows
 assert.deepEqual(packages,feedListingPackages.map(p=>({key:p.key,duration_hours:p.durationHours,cost_dc:p.costDC})))
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
 const state=async()=> (await db.query('select public.my_feed_listing() data')).rows[0].data
 const buy=(key='7h',request=crypto.randomUUID(),cost=1200,hours=7)=>db.query('select public.buy_feed_listing($1,$2,$3,$4) data',[key,request,cost,hours])
 const directory=async(search='')=>(await db.query('select public.public_directory($1) data',[search])).rows[0].data
 await as(null);assert.equal((await directory()).total,0);assert.equal((await db.query('select * from public.profiles')).rows.length,0);assert.equal((await db.query('select * from public.managed_profiles')).rows.length,0);await assert.rejects(state(),/permission denied/);await assert.rejects(buy(),/permission denied/)
 await as(reward);assert.equal((await state()).purchased_dc,0);await assert.rejects(buy(),/Not enough purchased DC/);await assert.rejects(db.query('select public.feed_purchased_dc($1)',[buyer]),/permission denied/);assert.equal((await db.query('select * from public.feed_listing_orders')).rows.length,0)
 await as(buyer)
 // Real approval RPC + upload RLS: receipts/submission alone cannot create purchased funds.
 const dep=crypto.randomUUID();await db.query('select public.create_manual_deposit(5000,$1)',[dep]);const path=buyer+'/'+dep+'/'+crypto.randomUUID()+'.png';await db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),path]);await db.query('select public.submit_bank_point_order($1,$2,$3,$4)',[dep,'Actual payer','claimed-reference',path]);assert.equal((await state()).purchased_dc,0)
 await as(finance);await db.query("select public.admin_confirm_manual_deposit($1,true,'independent-bank-ref',500000,'NGN','6977298247','Bank statement independently checked')",[dep]);await as(buyer);assert.equal((await state()).purchased_dc,5000);assert.equal((await state()).total_dc,5090)
 await assert.rejects(buy('7h',crypto.randomUUID(),1,7),/package changed/);await assert.rejects(buy('7h',crypto.randomUUID(),1200,720),/package changed/)
 await db.query('update public.profiles set is_public=false where id=$1',[buyer]);await assert.rejects(buy(),/public profile/);await db.query('update public.profiles set is_public=true where id=$1',[buyer]);await db.query('update public.social_links set is_public=false where profile_id=$1',[buyer]);await assert.rejects(buy(),/public profile/);await db.query('update public.social_links set is_public=true where profile_id=$1',[buyer])
 const request=crypto.randomUUID(),first=(await buy('7h',request)).rows[0].data;await buy('7h',request);await assert.rejects(buy('1d',request,2400,24),/request unavailable/);assert.equal((await state()).purchased_dc,3800);assert.equal((await state()).total_dc,3890)
 const renewed=(await buy('1d',crypto.randomUUID(),2400,24)).rows[0].data;assert.equal(new Date(renewed.starts_at).getTime(),new Date(first.ends_at).getTime());assert.equal(new Date(renewed.ends_at)-new Date(first.starts_at),31*3600000);assert.equal((await state()).purchased_dc,1400);assert.equal((await state()).in_feed,true);await assert.rejects(buy('2d',crypto.randomUUID(),4600,48),/Not enough purchased DC/)
 await as(other);await assert.rejects(buy('7h',request),/request unavailable/);assert.equal((await db.query('select * from public.feed_listing_orders')).rows.length,0);await assert.rejects(db.query('update public.feed_listing_orders set cost_dc=1'),/permission denied/);await assert.rejects(db.query('truncate public.feed_listing_orders'),/permission denied/)
 await as(null);assert.equal((await directory()).total,1);assert.equal((await directory('member_1')).total,1);assert.equal((await directory('member_2')).total,0);assert.equal((await db.query('select * from public.profiles')).rows.length,1);assert.equal((await db.query("select public.discovery_profile('member_1',false) p")).rows[0].p.id,buyer);assert.equal((await db.query("select public.discovery_profile('member_2',false) p")).rows[0].p,null)
 await as(other);await db.query('insert into public.blocks(blocker_id,blocked_id) values($1,$2)',[other,buyer]);assert.equal((await directory()).total,0);await as(buyer);assert.equal((await directory()).total,1); // own listing stays visible; viewer block is reciprocal.
 await db.exec('reset role');await db.query('insert into public.account_restrictions(user_id,reason,actor_id) values($1,$2,$3)',[buyer,'Moderation restriction',finance]);await as(null);assert.equal((await directory()).total,0);await as(buyer);await assert.rejects(buy(),/restricted/)
 await db.exec('reset role');await db.query('delete from public.account_restrictions where user_id=$1',[buyer]);await db.query("update public.feed_listing_orders set starts_at=starts_at-interval '40 days',ends_at=ends_at-interval '40 days' where user_id=$1",[buyer]);await as(null);assert.equal((await directory()).total,0);assert.equal((await db.query('select * from public.profiles')).rows.length,0)
 await as(buyer);assert.equal((await state()).in_feed,false);assert.ok((await state()).rows.every(r=>r.status==='expired'));assert.equal((await db.query("select public.discovery_profile('member_1',false) p")).rows[0].p.id,buyer,'Owner retains preview after expiry');assert.equal((await state()).total_dc,1490)
 // Negative ledger spending consumes purchased first; later arbitrary rewards never replenish it.
 await db.exec('reset role');await db.query("insert into public.points_ledger(user_id,points,reason,ref_key,created_at) values($1,-1000,'Other spending','other-debit',clock_timestamp())",[buyer]);await db.query('update public.points_balance set balance=balance-1000 where user_id=$1',[buyer]);await db.query("insert into public.points_ledger(user_id,points,reason,ref_key,created_at) values($1,9000,'Arbitrary reward','later-award',clock_timestamp())",[buyer]);await db.query('update public.points_balance set balance=balance+9000 where user_id=$1',[buyer]);await as(buyer);assert.equal((await state()).purchased_dc,400);await assert.rejects(buy(),/Not enough purchased DC/)
 await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from public.points_ledger where ref_key=$1",['feed-listing:'+request])).rows[0].n,1);assert.equal((await db.query("select count(*)::int n from public.audit_logs where action='feed_listing_purchased'")).rows[0].n,2)
 console.log('PASS paid feed real isolated SQL: original row preservation, exact catalogue, verified-bank purchased provenance, reward-only/forged-price/private/no-link/anonymous/other-owner denial, exact debit/idempotency, renewal without lost time, owner RLS, reciprocal blocks, restrictions, server-time expiry, no free managed/direct REST bypass, private owner preview/history, conservative other-spend accounting and append-only ledger/audit. PGlite serialization is not a production concurrency test.')
}finally{await db.close()}
