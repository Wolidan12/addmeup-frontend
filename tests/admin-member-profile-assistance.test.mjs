import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'

const db=new PGlite()
try{
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
 await db.exec(bootstrap)
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()')
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort())await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;',''))
 for(const file of ['install_manual_bank_transfers.sql','install_paid_feed_listings.sql','install_connection_rewards.sql','install_free_admin_managed_feed.sql','install_launch_rewards.sql','install_launch_reward_listing.sql','install_admin_member_feed_listings.sql'])await db.exec(await readFile('supabase/manual/'+file,'utf8'))
 await db.query('update public.launch_campaign set is_active=false')
 const ids={root:crypto.randomUUID(),moderator:crypto.randomUUID(),member:crypto.randomUUID(),private:crypto.randomUUID(),restricted:crypto.randomUUID(),banned:crypto.randomUUID(),staff:crypto.randomUUID(),other:crypto.randomUUID()}
 async function addUser(name,id,{role,isPublic=true,complete=false,privateWhatsapp=false,publicInstagram=false,banned=false}={}){
  await db.query('insert into auth.users(id,email,email_confirmed_at,banned_until) values($1,$2,now(),$3)',[id,name+'@example.test',banned?new Date(Date.now()+86400000).toISOString():null])
  await db.query('update public.profiles set username=$2,display_name=$3,is_public=$4,bio=$5,country=$6,avatar_url=$7,interests=$8 where id=$1',[id,name,complete?'Member '+name:'New creator',isPublic,complete?'Member-supplied bio':'',complete?'NG':'',complete?'https://images.example.test/'+name+'.jpg':null,complete?['music']:[]])
  if(role)await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[id,role])
  if(privateWhatsapp)await db.query("insert into public.social_links(profile_id,platform,url,is_public) values($1,'whatsapp','https://wa.me/2348012345678',false)",[id])
  if(publicInstagram)await db.query("insert into public.social_links(profile_id,platform,url,is_public) values($1,'instagram','https://instagram.com/'||$2,true)",[id,name])
 }
 await addUser('assistance_root',ids.root,{role:'super_admin'})
 await addUser('assistance_moderator',ids.moderator,{role:'moderator'})
 await addUser('assist_incomplete',ids.member,{privateWhatsapp:true})
 await addUser('assist_private',ids.private,{isPublic:false})
 await addUser('assist_restricted',ids.restricted)
 await addUser('assist_banned',ids.banned,{banned:true})
 await addUser('assist_staff',ids.staff,{role:'support_agent'})
 await addUser('assist_complete',ids.other,{complete:true,publicInstagram:true})
 await db.query("insert into public.account_restrictions(user_id,actor_id,reason) values($1,$2,'Test restriction')",[ids.restricted,ids.root])
 await db.exec('reset role')
 await db.exec(await readFile('supabase/manual/install_admin_member_profile_assistance.sql','utf8'))

 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
 const assistStatus=id=>db.query('select public.admin_member_profile_assist_status($1) data',[id]).then(r=>r.rows[0].data)
 const assist=(id,profile,links,reason='Member supplied and approved these profile updates',authorized=true,request=crypto.randomUUID())=>db.query('select public.admin_assist_member_profile($1,$2::jsonb,$3::jsonb,$4,$5,$6) data',[id,JSON.stringify(profile),JSON.stringify(links),reason,authorized,request]).then(r=>r.rows[0].data)
 const allFields={display_name:'Member-approved name',avatar_url:'https://images.example.test/member-photo.jpg',bio:'A short introduction supplied by the member.',country:'NG',interests:['music','design']}
 const approvedLinks=[{platform:'instagram',url:'https://instagram.com/member_creator'}]

 await as(null);await assert.rejects(assistStatus(ids.member),/permission denied|Permission denied/);await assert.rejects(assist(ids.member,allFields,approvedLinks),/permission denied|Permission denied/)
 await as(ids.moderator);await assert.rejects(assistStatus(ids.member),/Permission denied/);await assert.rejects(assist(ids.member,allFields,approvedLinks),/Permission denied/)
 await as(ids.root)
 const before=await assistStatus(ids.member)
 assert.equal(before.member_account,true);assert.equal(before.profile_public,true);assert.equal(before.restricted,false);assert.equal(before.profile_complete,false);assert.equal(before.profile_ready,false);assert.equal(before.can_assist,true)
 assert.deepEqual(before.missing_fields,['display_name','avatar_url','bio','country','interests'])
 assert.ok(!before.available_social_platforms.some(p=>p.key==='whatsapp'),'Private existing links are not exposed or offered for replacement')
 assert.ok(before.available_social_platforms.some(p=>p.key==='instagram'))
 assert.equal((await assistStatus(ids.private)).can_assist,false)
 assert.equal((await assistStatus(ids.restricted)).can_assist,false)
 assert.equal((await assistStatus(ids.banned)).restricted,true);assert.equal((await assistStatus(ids.banned)).can_assist,false)
 assert.equal((await assistStatus(ids.staff)).member_account,false)
 assert.equal((await assistStatus(ids.other)).can_assist,false,'Already complete and feed-ready members have no profile assistance action')
 await assert.rejects(assist(ids.member,allFields,approvedLinks,'short'),/8–1000/)
 await assert.rejects(assist(ids.member,allFields,approvedLinks,'Member supplied and approved these profile updates',false),/authorized/)
 await assert.rejects(assist(ids.private,allFields,approvedLinks),/profile public/i)
 await assert.rejects(assist(ids.restricted,allFields,approvedLinks),/Restricted member profiles/)
 await assert.rejects(assist(ids.banned,allFields,approvedLinks),/Restricted member profiles/)
 await assert.rejects(assist(ids.staff,allFields,approvedLinks),/Only member accounts/)
 await assert.rejects(assist(ids.member,{...allFields,username:'taken_username'},approvedLinks),/Only a missing signup username/)
 await assert.rejects(assist(ids.member,allFields,[{platform:'instagram',url:'https://instagram.com.evil.example/member'}]),/official host/)
 await assert.rejects(assist(ids.member,allFields,[null]),/valid object/)
 await assert.rejects(assist(ids.member,allFields,[{platform:'instagram',url:'https://instagram.com/member_creator',extra:'ignored'}]),/exactly a platform and URL/)
 await db.exec('reset role')
 const unchanged=(await db.query('select display_name,username,bio,country,avatar_url,interests,is_public from public.profiles where id=$1',[ids.member])).rows[0]
 assert.equal(unchanged.display_name,'New creator');assert.equal(unchanged.is_public,true)
 assert.equal((await db.query("select count(*)::int count from public.social_links where profile_id=$1 and platform='instagram'",[ids.member])).rows[0].count,0)

 // Without a new eligible public link, the whole profile update rolls back.
 await as(ids.root);await assert.rejects(assist(ids.member,allFields,[]),/Add a supported new public link/)
 await db.exec('reset role')
 assert.deepEqual((await db.query('select display_name,username,bio,country,avatar_url,interests,is_public from public.profiles where id=$1',[ids.member])).rows[0],unchanged)
 assert.equal((await db.query('select count(*)::int count from public.points_balance where user_id=$1',[ids.member])).rows[0].count,0)

 // The standard launch campaign is switched on for a synthetic confirmed account.
 // Completing the profile runs the unchanged first-50 trigger; no listing grant is created.
 await db.exec('reset role');await db.query('update public.launch_campaign set is_active=true')
 await as(ids.root)
 const request=crypto.randomUUID(),result=await assist(ids.member,allFields,approvedLinks,'Member supplied and approved these profile updates',true,request)
 assert.equal(result.request_id,request);assert.equal(result.user_id,ids.member);assert.equal(result.profile_complete,true);assert.equal(result.profile_ready,true);assert.deepEqual(result.updated_fields,['display_name','avatar_url','bio','country','interests']);assert.deepEqual(result.added_platforms,['instagram']);assert.equal(result.launch_reward_awarded,true)
 assert.deepEqual(await assist(ids.member,allFields,approvedLinks,'Member supplied and approved these profile updates',true,request),result,'Exact retry returns the original result without duplicate writes or rewards')
 await db.exec('reset role')
 const profile=(await db.query('select display_name,username,bio,country,avatar_url,interests,is_public from public.profiles where id=$1',[ids.member])).rows[0]
 assert.equal(profile.display_name,allFields.display_name);assert.equal(profile.username,'assist_incomplete');assert.equal(profile.bio,allFields.bio);assert.equal(profile.country,'NG');assert.equal(profile.avatar_url,allFields.avatar_url);assert.deepEqual(profile.interests,allFields.interests);assert.equal(profile.is_public,true)
 const links=(await db.query('select platform,url,is_public from public.social_links where profile_id=$1 order by platform',[ids.member])).rows
 assert.deepEqual(links,[{platform:'instagram',url:'https://instagram.com/member_creator',is_public:true},{platform:'whatsapp',url:'https://wa.me/2348012345678',is_public:false}],'New public link is additive; private existing link and visibility are unchanged')
 assert.equal((await db.query('select balance from public.points_balance where user_id=$1',[ids.member])).rows[0].balance,5000)
 assert.equal((await db.query('select count(*)::int count from public.launch_awards where user_id=$1',[ids.member])).rows[0].count,1)
 assert.equal((await db.query('select count(*)::int count from public.admin_member_feed_grants where user_id=$1',[ids.member])).rows[0].count,0,'Profile assistance never grants complimentary listing time')
 const audit=(await db.query("select action,target,meta from public.audit_logs where action='member_profile_assisted' and target=$1",[ids.member])).rows[0]
 assert.equal(audit.meta.member_authorized,true);assert.deepEqual(audit.meta.updated_fields,result.updated_fields);assert.deepEqual(audit.meta.added_public_platforms,['instagram']);assert.ok(!JSON.stringify(audit.meta).includes(allFields.avatar_url));assert.ok(!JSON.stringify(audit.meta).includes(approvedLinks[0].url),'Audit stores changed field/platform names, not private profile values or URLs')
 assert.equal((await db.query('select count(*)::int count from public.notifications where user_id=$1 and title=\'Profile details saved at your request\'',[ids.member])).rows[0].count,1)
 await as(ids.root)
 const after=await assistStatus(ids.member);assert.equal(after.profile_complete,true);assert.equal(after.profile_ready,true);assert.equal(after.can_assist,false);assert.deepEqual(after.missing_fields,[])
 await as(null);await assert.rejects(db.query('select * from public.admin_member_feed_grants'),/permission denied/)

 // The helper cannot overwrite filled member values even with fresh request IDs.
 await as(ids.root);await assert.rejects(assist(ids.other,{bio:'Replace existing member bio'},[]),/already complete and ready/)
 await db.exec('reset role')
 const finalOther=(await db.query('select bio,username from public.profiles where id=$1',[ids.other])).rows[0]
 assert.equal(finalOther.bio,'Member-supplied bio');assert.equal(finalOther.username,'assist_complete')

 const ui=await readFile('src/admin/AdminMemberProfileAssistance.jsx','utf8'),dialog=await readFile('src/admin/MemberFeedListingDialog.jsx','utf8'),admin=await readFile('src/pages/Admin.jsx','utf8')
 for(const text of ['admin_member_profile_assist_status','admin_assist_member_profile','member_authorized','available_social_platforms','missing_fields','launch_reward_awarded','localStorage','Only a missing','member-supplied','privacy settings'])assert.ok(ui.includes(text),text)
 assert.ok(ui.includes('setConfirmed(false)'),'Any profile, link, reason, or status change invalidates the prior consent checkbox')
 assert.ok(ui.includes('onClick={()=>onRefresh?.()}'),'The assistance refresh action refreshes the parent eligibility status')
 assert.ok(ui.includes('if(!value.can_assist)clearPending()'),'Resolved/ineligible requests do not leave stale retry IDs blocking future assistance')
 assert.ok(!ui.includes('requestRef'),'No stale request ref can crash a successful update')
 assert.ok(dialog.includes('AdminMemberProfileAssistance'));assert.ok(dialog.includes('!status.profile_complete||!status.profile_ready'));assert.ok(dialog.includes('Incomplete · required to list'));assert.ok(!dialog.includes('The existing “Profile complete” badge is derived'),'The duplicated badge explanation stays removed');assert.ok(admin.includes('onProfileAssisted='))
 console.log('PASS admin-assisted member profile completion: super-admin-only, consent and audit, missing-fields-only updates, official new public links without exposing or changing private links, privacy/restriction/staff guards, atomic rollback, profile-completion badge derived from saved data, unchanged listing state, idempotent retries, and existing first-50 launch award trigger preserved. PGlite isolated fixtures, not live member or production acceptance.')
}finally{await db.close()}
