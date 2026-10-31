import {PGlite} from '@electric-sql/pglite'
import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {registrationDetails,profileDetails,profileCompletion} from '../src/lib/accountValidation.js'
import {validSocialUrl} from '../src/lib/validation.js'
const registration={full_name:' Jane Creator ',username:'Jane_Creator',email:' JANE@example.org ',password:'test-only-password',confirm:'test-only-password',terms_accepted:true}
assert.equal(registrationDetails(registration).metadata.username,'jane_creator');assert.equal(registrationDetails(registration).email,'jane@example.org')
for(const bad of [{confirm:'wrong'},{terms_accepted:false},{full_name:'<script>'},{username:'bad-name'},{password:'1234567',confirm:'1234567'},{email:'bad'}])assert.throws(()=>registrationDetails({...registration,...bad}))
const permitted=profileDetails({username:'Jane_creator',display_name:' Jane ',location:' Lagos ',categories:'music, education',interests:'art,art',creator_xp:999,created_at:'yesterday',is_sponsored:true,balance:1000})
assert.equal(permitted.location,'Lagos');assert.deepEqual(permitted.interests,['art']);for(const key of ['creator_xp','created_at','is_sponsored','balance'])assert.equal(key in permitted,false)
assert.equal(profileCompletion({display_name:'J',username:'jane',avatar_url:'https://example.org/a',bio:'hello',country:'NG',interests:['music']},1),100)
for(const [p,url] of [['youtube','https://youtube.com/@jane'],['telegram','https://t.me/jane'],['instagram','https://www.instagram.com/jane']])assert.equal(validSocialUrl(p,url),true)
for(const url of ['javascript:alert(1)','https://youtube.com.evil.org/jane','https://youtube.com@evil.org/jane','https://youtube.com:444/jane','https://youtube.com\\@evil.org/jane'])assert.equal(validSocialUrl('youtube',url),false)
assert.equal(validSocialUrl('whatsapp','--- 123'),false)
assert.equal(validSocialUrl('custom','https://example.org/jane',[{key:'custom',hosts:['example.org']}]),true)
const db=new PGlite(),bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
await db.exec(bootstrap)
await db.exec('alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()')
await db.exec('alter default privileges in schema public grant all on tables to anon,authenticated')
for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
const root='a1000000-0000-4000-8000-000000000001',user='a2000000-0000-4000-8000-000000000002',other='a3000000-0000-4000-8000-000000000003'
await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[root,'owner@example.org']);await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[root])
await db.exec("alter table auth.users add column raw_user_meta_data jsonb not null default '{}'::jsonb")
async function signup(id,metadata,email='jane@example.org'){return db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,email,JSON.stringify(metadata)])}
await assert.rejects(signup(user,{username:'jane_creator'}),/account details and terms/)
await assert.rejects(signup(user,{...registrationDetails(registration).metadata,terms_accepted:false}),/account details and terms/)
await signup(user,{...registrationDetails(registration).metadata,role:'super_admin',creator_xp:999,is_sponsored:true})
const query=async(sql,args=[])=>(await db.query(sql,args)).rows
const legacy='a4000000-0000-4000-8000-000000000004';await signup(legacy,{},'legacy@example.org');assert.equal((await query('select count(*)::int n from public.account_consents where user_id=$1',[legacy]))[0].n,0);
assert.equal((await query('select username from public.profiles where id=$1',[user]))[0].username,'jane_creator')
assert.equal((await query('select is_public from public.profiles where id=$1',[user]))[0].is_public,false)
assert.equal((await query('select count(*)::int n from public.account_consents where user_id=$1',[user]))[0].n,1)
assert.equal((await query('select count(*)::int n from public.user_roles where user_id=$1',[user]))[0].n,0)
await assert.rejects(signup(other,registrationDetails(registration).metadata,'other@example.org'),/unique constraint/)
await signup(other,{full_name:'Other Creator',username:'other_creator',terms_accepted:true},'other@example.org')
async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
await as(user)
assert.equal((await query('select public.is_username_available($1) available',['jane_creator']))[0].available,false)
for(const column of ["creator_xp=999","created_at=now()","is_sponsored=true","id='a4000000-0000-4000-8000-000000000004'"])await assert.rejects(db.query(`update public.profiles set ${column} where id=$1`,[user]),/permission denied/)
await assert.rejects(db.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[user]),/permission denied|row-level/)
await assert.rejects(db.query('update public.points_balance set balance=999 where user_id=$1',[user]),/permission denied/)
await assert.rejects(db.query("insert into public.points_ledger(user_id,points,reason) values($1,999,'daily_checkin')",[user]),/permission denied/)
assert.equal((await query("update public.profiles set bio='cross-user attempt' where id=$1 returning id",[other])).length,0)
await db.query("update public.profiles set bio='My story',country='NG',location='Lagos',categories=array['education'] where id=$1",[user])
for(const [p,url] of [['whatsapp','+234 800 000 0000'],['instagram','https://instagram.com/jane'],['youtube','https://youtube.com/@jane'],['telegram','https://t.me/jane']])await db.query('insert into public.social_links(profile_id,platform,url,is_public) values($1,$2,$3,false)',[user,p,url])
for(const url of ['javascript:alert(1)','https://youtube.com.evil.org/jane','https://youtube.com@evil.org/jane','https://youtube.com:444/jane'])await assert.rejects(db.query("update public.social_links set url=$2 where profile_id=$1 and platform='youtube'",[user,url]),/valid official/)
await as(other);assert.equal((await query('select * from public.social_links where profile_id=$1',[user])).length,0);assert.equal((await query('select * from public.account_consents where user_id=$1',[user])).length,0)
assert.equal((await query("delete from public.social_links where profile_id=$1 returning id",[user])).length,0)
await as(user);await db.query("update public.profiles set is_public=true where id=$1",[user]);await db.query("update public.social_links set is_public=true where profile_id=$1 and platform='youtube'",[user]);await db.query("delete from public.social_links where profile_id=$1 and platform='telegram'",[user])
await as(null);assert.equal((await query('select * from public.social_links where profile_id=$1',[user])).length,1)
await as(user);await assert.rejects(db.query("select public.admin_save_social_platform('custom','Custom',array['example.org'],true,'Testing permission enforcement')"),/Permission denied/)
await as(root);await db.query("select public.admin_save_social_platform('custom','Custom',array['example.org'],true,'Enable custom platform for test')")
await assert.rejects(db.query("select public.admin_save_social_platform('bad','Bad',array['127.0.0.1'],true,'Reject unsafe internal endpoint')"),/public DNS/)
await assert.rejects(db.query("select public.admin_save_social_platform('youtube','Fake',array['evil.org'],true,'Cannot replace built in hosts')"),/protected/)
await as(user);await db.query("insert into public.social_links(profile_id,platform,url) values($1,'custom','https://example.org/jane')",[user])
await db.exec('reset role');await db.exec('begin');for(const [amount,reason,reference] of [[125,'daily_checkin','test-unique-checkin'],[200,'Bank transfer: test','test-purchase'],[25,'task:complete-profile','test-task']]){await db.query('insert into public.points_balance(user_id,balance) values($1,$2) on conflict(user_id) do update set balance=public.points_balance.balance+$2',[user,amount]);await db.query('insert into public.points_ledger(user_id,points,reason,ref_key) values($1,$2,$3,$4)',[user,amount,reason,reference])}await db.exec('commit');const progress=(await query('select creator_xp,creator_level from public.profiles where id=$1',[user]))[0];assert.equal(Number(progress.creator_xp),150);assert.equal(Number(progress.creator_level),2);assert.equal(Number((await query('select balance from public.points_balance where user_id=$1',[user]))[0].balance),350)
await as(user);assert.equal((await query("select public.member_overview() data"))[0].data.profile.creator_xp,150)
for(const table of ['account_consents','social_platforms'])for(const role of ['anon','authenticated'])assert.equal((await query('select has_table_privilege($1,$2,\'truncate\') yes',[role,'public.'+table]))[0].yes,false)
await db.close();console.log('Account validation + isolated PostgreSQL: Auth-shaped registration metadata/consent, atomic username collisions, ignored role spoofing, own profile columns/RLS, private links, add/edit/delete, all 8 platforms, custom platform admin/audit, protected balances/history/XP, earned-only XP and levels passed. This is not a live GoTrue/email-delivery test.')
