import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {feedListingPackages} from '../src/lib/feedListingPackages.js'
import {hasCompleteProfile} from '../src/lib/profileBadge.js'
import {resources,rowActions,canView} from '../src/admin/resources.js'
import {relationshipMessage} from '../src/lib/connectionRewards.js'

const db=new PGlite()
try{
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
 await db.exec(bootstrap)
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()')
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort())await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;',''))
 for(const file of ['install_manual_bank_transfers.sql','install_paid_feed_listings.sql','install_connection_rewards.sql','install_free_admin_managed_feed.sql','install_launch_rewards.sql','install_launch_reward_listing.sql'])await db.exec(await readFile('supabase/manual/'+file,'utf8'))
 // Isolate this feature test from automatic first-50 reward fixture awards.
 await db.query('update public.launch_campaign set is_active=false')

 const ids={root:crypto.randomUUID(),finance:crypto.randomUUID(),moderator:crypto.randomUUID(),staff:crypto.randomUUID(),paid:crypto.randomUUID(),sponsored:crypto.randomUUID(),incomplete:crypto.randomUUID(),private:crypto.randomUUID(),noLink:crypto.randomUUID(),restricted:crypto.randomUUID(),buyer:crypto.randomUUID(),actor:crypto.randomUUID(),rewardTarget:crypto.randomUUID()}
 const addUser=async(name,id,{role,isPublic=true,publicLink=true,privateLink=false,completeProfile=true}={})=>{
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,name+'@example.org'])
  await db.query('update public.profiles set username=$2,display_name=$3,is_public=$4,bio=$5,country=$6,avatar_url=$7,interests=$8 where id=$1',[id,name,'Member '+name,isPublic,completeProfile?'A complete member profile':'',completeProfile?'NG':'',completeProfile?'https://example.org/'+name+'.jpg':null,completeProfile?['music']:[]])
  if(publicLink)await db.query("insert into public.social_links(profile_id,platform,url,is_public) values($1,'instagram',$2,true)",[id,'https://instagram.com/'+name])
  if(privateLink)await db.query("insert into public.social_links(profile_id,platform,url,is_public) values($1,'whatsapp',$2,false)",[id,'https://wa.me/2348012345678'])
  if(role)await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[id,role])
 }
 await addUser('listing_root',ids.root,{role:'super_admin'})
 await addUser('listing_finance',ids.finance,{role:'finance_admin'})
 await addUser('listing_moderator',ids.moderator,{role:'moderator'})
 await addUser('listing_staff',ids.staff,{role:'support_agent'})
 await addUser('member_with_paid_time',ids.paid,{publicLink:true})
 await addUser('member_sponsored',ids.sponsored,{publicLink:true,privateLink:true})
 await addUser('member_incomplete',ids.incomplete,{publicLink:true,completeProfile:false})
 await addUser('private_member',ids.private,{isPublic:false,publicLink:true})
 await addUser('member_without_link',ids.noLink,{publicLink:false})
 await addUser('restricted_member',ids.restricted,{publicLink:true})
 await addUser('listing_buyer',ids.buyer,{publicLink:true})
 await addUser('connection_actor',ids.actor,{publicLink:true})
 await addUser('paid_connection_target',ids.rewardTarget,{publicLink:true})
 await db.query("insert into public.account_restrictions(user_id,actor_id,reason) values($1,$2,'Restricted test member')",[ids.restricted,ids.root])
 await db.query("insert into public.feed_listing_orders(id,user_id,package_key,cost_dc,duration_hours,starts_at,ends_at) values($1,$2,'1d',2400,24,now()-interval '1 hour',now()+interval '23 hours'),($3,$4,'7h',1200,7,now(),now()+interval '7 hours')",[crypto.randomUUID(),ids.paid,crypto.randomUUID(),ids.rewardTarget])
 await db.query('insert into public.points_balance(user_id,balance) values($1,0),($2,0),($3,0)',[ids.actor,ids.paid,ids.buyer])

 const snapshot=async()=>JSON.stringify(await Promise.all(['auth.users','public.profiles','public.managed_profiles','public.points_balance','public.points_ledger','public.bank_point_orders','public.notifications','public.audit_logs','public.feed_listing_orders','public.feed_listing_packages','public.feed_listing_settings','public.connection_reward_settings','public.member_connections','public.connection_reward_events','public.blocks','public.favourites','public.social_links','public.launch_awards','public.launch_campaign'].map(async table=>(await db.query('select * from '+table+' order by 1')).rows)))
 const beforeInstall=await snapshot()
 await db.exec(await readFile('supabase/manual/install_admin_member_feed_listings.sql','utf8'))
 assert.equal(await snapshot(),beforeInstall,'Installer preserves existing member, wallet, listing, reward, relationship and managed-listing rows')

 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
 const status=id=>(db.query('select public.admin_member_feed_status($1) data',[id]).then(r=>r.rows[0].data))
 const grantAuthorized=(id,request,packageKey='7h',hours=7,reason='Member requested a complimentary feed listing',authorized=true)=>db.query('select public.admin_grant_member_feed($1,$2,$3,$4,$5,$6) data',[id,packageKey,hours,reason,authorized,request])
 const revoke=(id,request,reason='Member asked to end the complimentary listing')=>db.query('select public.admin_revoke_member_feed($1,$2,true,$3) data',[id,reason,request]).then(r=>r.rows[0].data)
 const state=()=>db.query('select public.my_feed_listing(0) data').then(r=>r.rows[0].data)
 const directory=(search='')=>db.query("select public.public_directory($1,'','','',0) data",[search]).then(r=>r.rows[0].data)
 const balance=async id=>Number((await db.query('select balance from public.points_balance where user_id=$1',[id])).rows[0]?.balance??0)

 assert.equal(resources.find(r=>r.key==='profiles').roles.includes('finance_admin'),false)
 assert.equal(canView('finance_admin',resources.find(r=>r.key==='profiles')),false)
 assert.equal(rowActions('profiles',{id:ids.sponsored,staff_role:'user'},'super_admin').some(a=>a.action==='member_feed_listing'),true)
 assert.equal(rowActions('profiles',{id:ids.root,is_self:true},'super_admin').some(a=>a.action==='member_feed_listing'),false)
 assert.equal(rowActions('profiles',{id:ids.staff,staff_role:'support_agent'},'super_admin').some(a=>a.action==='member_feed_listing'),false)
 assert.equal(rowActions('profiles',{id:ids.sponsored,staff_role:'user'},'moderator').some(a=>a.action==='member_feed_listing'),false)

 await as(null);await assert.rejects(status(ids.sponsored),/permission denied|Permission denied/);await assert.rejects(db.query('select public.admin_grant_member_feed($1,$2,7,$3,true,$4)',[ids.sponsored,'7h','A requested member feature',crypto.randomUUID()]),/permission denied|Permission denied/);await assert.rejects(revoke(ids.sponsored,crypto.randomUUID()),/permission denied|Permission denied/)
 await as(ids.actor);await assert.rejects(status(ids.sponsored),/Permission denied/);await assert.rejects(db.query('select public.admin_grant_member_feed($1,$2,7,$3,true,$4)',[ids.sponsored,'7h','A requested member feature',crypto.randomUUID()]),/Permission denied/);await assert.rejects(revoke(ids.sponsored,crypto.randomUUID()),/Permission denied/)
 await as(ids.finance);await assert.rejects(status(ids.sponsored),/Permission denied/);await assert.rejects(revoke(ids.sponsored,crypto.randomUUID()),/Permission denied/)
 await as(ids.root)
 const eligible=await status(ids.sponsored);assert.equal(eligible.member_account,true);assert.equal(eligible.profile_ready,true);assert.equal(eligible.profile_complete,true);assert.equal(eligible.eligible,true);assert.equal(eligible.listed_now,false);assert.equal(eligible.packages.length,feedListingPackages.length)
 await db.exec('reset role');const matchingPredicate=(await db.query('select public.admin_feed_profile_complete($1) badge,public.launch_profile_complete($1) legacy',[ids.sponsored])).rows[0];assert.deepEqual(matchingPredicate,{badge:true,legacy:true},'All six completion fields match migration 018 for a valid profile');await as(ids.root)
 const incompleteStatus=await status(ids.incomplete);assert.equal(incompleteStatus.profile_ready,true);assert.equal(incompleteStatus.profile_complete,false);assert.equal(incompleteStatus.eligible,false);await db.exec('reset role');assert.deepEqual((await db.query('select public.admin_feed_profile_complete($1) badge,public.launch_profile_complete($1) legacy',[ids.incomplete])).rows[0],{badge:false,legacy:false});await as(ids.root);await assert.rejects(grantAuthorized(ids.incomplete,crypto.randomUUID()),/profile must be complete/i)
 for(const id of [ids.private,ids.noLink,ids.restricted]){const data=await status(id);assert.equal(data.profile_ready,false);assert.equal(data.eligible,false);await assert.rejects(grantAuthorized(id,crypto.randomUUID()),/public|social link|restricted/i)}
 assert.equal((await status(ids.staff)).member_account,false);await assert.rejects(grantAuthorized(ids.staff,crypto.randomUUID()),/Only member accounts/)
 await assert.rejects(grantAuthorized(ids.root,crypto.randomUUID()),/Member and request reference required/)
 await assert.rejects(grantAuthorized(ids.sponsored,crypto.randomUUID(),'7h',24),/same available listing duration/)
 await assert.rejects(grantAuthorized(ids.sponsored,crypto.randomUUID(),'7h',7,'Member requested a complimentary feed listing',false),/authorized/)
 await db.exec('reset role');await db.query('update public.feed_listing_settings set enabled=false');await as(ids.root);assert.equal((await status(ids.sponsored)).eligible,false);await assert.rejects(grantAuthorized(ids.sponsored,crypto.randomUUID()),/paused/);await db.exec('reset role');await db.query('update public.feed_listing_settings set enabled=true')

 await db.exec('reset role')
 const paidBefore=(await db.query('select * from public.feed_listing_orders where user_id=$1',[ids.paid])).rows[0]
 const recordsBefore=await snapshot()
 await as(ids.root)
 await assert.rejects(grantAuthorized(ids.sponsored,paidBefore.id),/Request reference unavailable/,'Paid-order IDs cannot be reused for complimentary grants')
 const firstRequest=crypto.randomUUID(),first=(await grantAuthorized(ids.paid,firstRequest,'7h',7)).rows[0].data
 assert.equal(first.user_id,ids.paid);assert.equal(first.cost_dc,0);assert.equal(first.source,'admin_feature');assert.equal(first.duration_hours,7)
 assert.ok(Date.parse(first.starts_at)>=Date.parse(paidBefore.ends_at),'Admin time queues after all pre-booked paid time')
 assert.deepEqual((await grantAuthorized(ids.paid,firstRequest,'7h',7)).rows[0].data,first,'Same admin request returns its original result')
 await assert.rejects(grantAuthorized(ids.paid,firstRequest,'7h',7,'A different reason must not reuse the reference'),/Request reference unavailable/)
 const second=(await grantAuthorized(ids.paid,crypto.randomUUID(),'1d',24)).rows[0].data
 assert.equal(Date.parse(second.starts_at),Date.parse(first.ends_at),'Later complimentary grants queue after existing sponsored time')
 await db.exec('reset role')
 const originalPackages=(await db.query('select key,label,duration_hours,cost_dc,enabled from public.feed_listing_packages order by duration_hours')).rows
 assert.deepEqual(originalPackages,feedListingPackages.map(p=>({key:p.key,label:p.label,duration_hours:p.durationHours,cost_dc:p.costDC,enabled:true})))
 const recordsAfter=await snapshot()
 const beforeValues=JSON.parse(recordsBefore),afterValues=JSON.parse(recordsAfter)
 for(const i of [0,1,2,3,4,5,8,9,10,11,12,13,14,15,16,17,18])assert.deepEqual(afterValues[i],beforeValues[i],`Complimentary grant does not mutate protected existing table ${i}`)
 assert.equal((await db.query('select count(*)::int n from public.admin_member_feed_grants')).rows[0].n,2)
 assert.ok((await db.query('select count(*)::int n from public.notifications where user_id=$1',[ids.paid])).rows[0].n>=1)
 await as(ids.root)
 const afterGrantStatus=await status(ids.paid);assert.equal(afterGrantStatus.profile_ready,true);assert.equal(Date.parse(afterGrantStatus.admin_until),Date.parse(second.ends_at));assert.equal(afterGrantStatus.listed_now,true)

 await as(ids.paid);const paidMemberState=await state(ids.paid);assert.ok(paidMemberState.rows.some(r=>r.id===first.id&&r.source==='admin_feature'));assert.equal(paidMemberState.rows.find(r=>r.id===first.id).status,'queued');assert.equal(paidMemberState.in_feed,true)
 await as(null);let publicFeed=await directory('@member_sponsored');assert.equal(publicFeed.total,0)
 publicFeed=await directory('@member_with_paid_time');assert.equal(publicFeed.total,1);const paidProjection=publicFeed.rows[0];assert.equal(paidProjection.managed,false);assert.equal(paidProjection.feed_listing_paid,true);assert.ok(paidProjection.feed_ends_at);assert.equal(typeof paidProjection.is_connected,'boolean');assert.equal(typeof paidProjection.is_saved,'boolean')
 await db.exec('reset role');await db.query("update public.profiles set interests='{}'::text[] where id=$1",[ids.paid]);await as(null)
 const incompletePaidFeed=await directory('@member_with_paid_time');assert.equal(incompletePaidFeed.total,1,'The existing member-paid listing remains visible when an admin grant is only scheduled');assert.equal(incompletePaidFeed.rows[0].feed_listing_paid,true);assert.equal(hasCompleteProfile(incompletePaidFeed.rows[0]),false)
 await as(ids.root);const incompletePaidStatus=await status(ids.paid);assert.equal(incompletePaidStatus.profile_complete,false);assert.equal(incompletePaidStatus.eligible,false);assert.equal(incompletePaidStatus.listed_now,true,'Status reports the independently active paid listing without treating it as admin-sponsored')
 await db.exec('reset role');await db.query("update public.profiles set interests=array['music'] where id=$1",[ids.paid]);await as(null)

 await as(ids.root)
 const sponsoredRequest=crypto.randomUUID(),sponsoredGrant=(await grantAuthorized(ids.sponsored,sponsoredRequest,'7h',7)).rows[0].data
 assert.ok(Date.parse(sponsoredGrant.starts_at)<=Date.now()+1000)
 await as(null);publicFeed=await directory('@member_sponsored');assert.equal(publicFeed.total,1);const publicProjection=publicFeed.rows[0];assert.equal(publicProjection.id,ids.sponsored);assert.equal(publicProjection.managed,false);assert.equal(publicProjection.feed_listing_paid,false);assert.ok(publicProjection.feed_ends_at);assert.equal(publicProjection.social_links.length,1);assert.ok(!JSON.stringify(publicProjection).includes('private_member'));assert.equal(hasCompleteProfile(publicProjection),true,'Every active admin-sponsored feed card meets the visible profile-complete badge rules')
 assert.equal((await db.query("select public.discovery_profile('member_sponsored',false) data")).rows[0].data.id,ids.sponsored)
 await db.exec('reset role');await db.query('alter table public.profiles disable trigger validate_account_profile');await db.query("update public.profiles set interests=array['   '] where id=$1",[ids.sponsored]);await db.query('alter table public.profiles enable trigger validate_account_profile')
 const whitespaceInterest=(await db.query('select public.admin_feed_profile_complete($1) badge,public.launch_profile_complete($1) legacy,to_jsonb(p) profile from public.profiles p where id=$1',[ids.sponsored])).rows[0];assert.equal(whitespaceInterest.legacy,true,'Migration 018 uses cardinality and sees the historical nonempty array');assert.equal(whitespaceInterest.badge,false,'The admin gate follows the visible badge and rejects whitespace-only interests');assert.equal(hasCompleteProfile(whitespaceInterest.profile),false)
 await as(null);assert.equal((await directory('@member_sponsored')).total,0,'An incomplete sponsored profile is hidden from the public feed');assert.equal((await db.query("select public.discovery_profile('member_sponsored',false) data")).rows[0].data,null)
 await as(ids.root);const noLongerComplete=await status(ids.sponsored);assert.equal(noLongerComplete.profile_complete,false);assert.equal(noLongerComplete.eligible,false);assert.equal(noLongerComplete.listed_now,false)
 await db.exec('reset role');await db.query("update public.profiles set interests=array['music'] where id=$1",[ids.sponsored]);await as(null)
 assert.equal((await directory('@member_sponsored')).total,1,'The completed profile becomes visible again without altering its grant')
 assert.equal((await db.query('select count(*)::int n from public.profiles where id=$1',[ids.sponsored])).rows[0].n,1,'An active sponsored member profile is readable through the existing public-profile RLS policy')
 await assert.rejects(db.query('select * from public.admin_member_feed_grants'),/permission denied/)
 assert.equal((await db.query("select public.discovery_profile('member_without_link',false) data")).rows[0].data,null)
 // Reciprocal blocks hide sponsored listings for that viewer without hiding them publicly.
 await db.exec('reset role');await db.query('insert into public.blocks(blocker_id,blocked_id) values($1,$2),($2,$1)',[ids.actor,ids.sponsored])
 await as(null);assert.equal((await directory('@member_sponsored')).total,1)
 await as(ids.actor);assert.equal((await directory('@member_sponsored')).total,0);assert.equal((await db.query("select public.discovery_profile('member_sponsored',false) data")).rows[0].data,null)
 await db.exec('reset role');await db.query('delete from public.blocks where blocker_id in ($1,$2) and blocked_id in ($1,$2)',[ids.actor,ids.sponsored])

 // Existing admin-managed listings remain a separate, free managed_profiles branch.
 const managedId=crypto.randomUUID()
 const managedPayload={username:'separate_managed',display_name:'Separate Managed',bio:'A managed community card',country:'NG',interests:['art'],avatar_url:'https://example.org/managed-card.jpg',is_public:true,social_links:[]}
 await db.exec('reset role');const usersBefore=(await db.query('select count(*)::int n from auth.users')).rows[0].n;await as(ids.root)
 await db.query('select public.admin_save_managed_profile($1,$2,$3)',[managedId,managedPayload,'Keep managed listing separate from members'])
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,usersBefore)
 await as(null);const mixed=(await directory()).rows;assert.ok(mixed.some(p=>p.id===ids.sponsored&&p.managed===false));assert.ok(mixed.some(p=>p.id===managedId&&p.managed===true));assert.equal((await db.query('select * from public.managed_profiles')).rows.length,0)

 // Existing 7-DC connection rewards stay tied to paid listings, and never become listing funds.
 await as(ids.actor);const actorBalance=await balance(ids.actor)
 const sponsoredConnect=(await db.query("select public.discovery_relationship($1,'connect',true) data",[ids.sponsored])).rows[0].data
 assert.equal(sponsoredConnect.reward_dc,0);assert.equal(sponsoredConnect.reward_status,'not_eligible');assert.equal(await balance(ids.actor),actorBalance)
 assert.equal((await db.query('select public.discovery_relationship($1,$2,false)',[ids.sponsored,'connect'])).rows.length,1)
 const reconnect=(await db.query("select public.discovery_relationship($1,'connect',true) data",[ids.sponsored])).rows[0].data
 assert.equal(reconnect.reward_dc,0);assert.equal(reconnect.reward_status,'already_processed')
 const paidConnect=(await db.query("select public.discovery_relationship($1,'connect',true) data",[ids.rewardTarget])).rows[0].data
 assert.equal(paidConnect.reward_dc,7);assert.equal(paidConnect.reward_status,'granted');assert.equal(await balance(ids.actor),actorBalance+7)
 assert.equal((await state()).listing_dc,0,'7-DC connection reward remains excluded from eligible listing funds')
 assert.match(relationshipMessage(sponsoredConnect),/Complimentary listings do not qualify/)

 // Revoke only sponsored rows; paid orders/wallet/ledger remain byte-for-byte unchanged.
 await db.exec('reset role');const paidEconomic=(await db.query("select (select balance from public.points_balance where user_id=$1) balance,(select count(*) from public.points_ledger where user_id=$1)::int ledger,(select count(*) from public.feed_listing_orders where user_id=$1)::int orders",[ids.paid])).rows[0]
 await as(ids.root);const revokedPaid=await revoke(ids.paid,crypto.randomUUID());assert.equal(revokedPaid.revoked_count,2);assert.equal(revokedPaid.listed_now,true)
 await db.exec('reset role');const paidEconomicAfter=(await db.query("select (select balance from public.points_balance where user_id=$1) balance,(select count(*) from public.points_ledger where user_id=$1)::int ledger,(select count(*) from public.feed_listing_orders where user_id=$1)::int orders",[ids.paid])).rows[0]
 assert.deepEqual(paidEconomicAfter,paidEconomic)
 const paidRows=(await db.query('select * from public.feed_listing_orders where user_id=$1',[ids.paid])).rows;assert.equal(paidRows.length,1);assert.deepEqual(paidRows[0],paidBefore)
 await as(ids.root);await assert.rejects(revoke(ids.paid,paidBefore.id),/Request reference unavailable/,'Paid-order IDs cannot be reused for revocation')
 const revokeRequest=crypto.randomUUID(),revoked=await revoke(ids.sponsored,revokeRequest);assert.equal(revoked.revoked_count,1);assert.equal(revoked.listed_now,false);assert.deepEqual(await revoke(ids.sponsored,revokeRequest),revoked)
 await as(ids.sponsored);const revokedState=await state(ids.sponsored);assert.equal(revokedState.rows[0].status,'revoked');assert.equal(revokedState.in_feed,false);assert.equal(revokedState.active_until,null)
 await db.exec('reset role')
 await assert.rejects(db.query('update public.admin_member_feed_grants set reason=\'altered\' where user_id=$1',[ids.sponsored]),/immutable/)
 await assert.rejects(db.query('delete from public.admin_member_feed_grants where user_id=$1',[ids.sponsored]),/append-only/)
 await as(null);assert.equal((await directory('@member_sponsored')).total,0)

 // A real paid member purchase still charges the original package price, after complimentary time.
 await as(ids.buyer);const deposit=crypto.randomUUID();await db.query('select public.create_manual_deposit(5000,$1)',[deposit]);const receipt=ids.buyer+'/'+deposit+'/'+crypto.randomUUID()+'.png'
 await db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),receipt])
 await db.query('select public.submit_bank_point_order($1,$2,$3,$4)',[deposit,'Actual test payer','unique-test-bank-ref',receipt])
 await as(ids.finance);await db.query("select public.admin_confirm_manual_deposit($1,true,'verified-test-statement',500000,'NGN','6977298247','Independent isolated test statement')",[deposit])
 await as(ids.root);const buyerGrant=(await grantAuthorized(ids.buyer,crypto.randomUUID(),'7h',7)).rows[0].data
 await as(ids.buyer);const beforePurchase=await state(ids.buyer);assert.equal(beforePurchase.listing_dc,5000);assert.equal(beforePurchase.purchased_dc,5000)
 const purchase=(await db.query("select public.buy_feed_listing('7h',$1,1200,7) data",[crypto.randomUUID()])).rows[0].data
 assert.equal(purchase.cost_dc,1200);assert.equal(purchase.duration_hours,7);assert.ok(Date.parse(purchase.starts_at)>=Date.parse(buyerGrant.ends_at))
 const afterPurchase=await state(ids.buyer);assert.equal(afterPurchase.purchased_dc,3800);assert.equal(afterPurchase.listing_dc,3800);assert.equal(afterPurchase.rows.find(r=>r.id===purchase.id).source,'member_purchase')
 await assert.rejects(db.query("select public.buy_feed_listing('1d',$1,1,24)",[crypto.randomUUID()]),/package changed/)

 await db.exec('reset role')
 for(const file of ['src/pages/Admin.jsx','src/components/ListingGuide.jsx','src/components/FeedListingInfo.jsx','src/admin/MemberFeedListingDialog.jsx','src/admin/resources.js']){
  const text=await readFile(file,'utf8');assert.ok(text.length>0,file)
 }
 const adminPage=await readFile('src/pages/Admin.jsx','utf8'),dialog=await readFile('src/admin/MemberFeedListingDialog.jsx','utf8'),guide=await readFile('src/components/ListingGuide.jsx','utf8'),listing=await readFile('src/components/FeedListingInfo.jsx','utf8')
 assert.ok(adminPage.includes("import MemberFeedListingDialog from '../admin/MemberFeedListingDialog'"));assert.ok(adminPage.includes("operation.action==='member_feed_listing'?<MemberFeedListingDialog"))
 for(const text of ['admin_member_feed_status','admin_grant_member_feed','admin_revoke_member_feed','p_expected_hours','member_authorized','Retry same request','payload_hash','localStorage','status.profile_complete','Profile-complete badge'])assert.ok(dialog.includes(text),text)
 assert.ok(guide.includes('THREE QUICK STEPS'));assert.ok(guide.includes('signup username'));assert.ok(guide.includes('7-DC connection rewards do not'))
 assert.ok(listing.includes('id="feed-listing-options"'));assert.ok(listing.includes('persistListingRequest'))
 console.log('PASS registered-member feed listing: exact installed baseline and preservation, super-admin-only action/RPC, member/privacy/restriction eligibility, consent and package guards, idempotent audit/retry, complimentary queue and revoke, unchanged paid order/wallet/price, public feed/profile/RLS and managed-listing separation, saved revoked-history contract, normal paid checkout after sponsored time, 7-DC reward exclusion and no reconnect reward. PGlite isolated SQL, not live acceptance or production deployment.')
}finally{await db.close()}
