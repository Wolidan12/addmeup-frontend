// Legacy economy regression through 017. Launch/mission cutover and revoked legacy claims are covered in launch-missions.test.mjs.
// Real PostgreSQL semantics in an isolated PGlite fixture; no live money or Auth users.
import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {formatDC} from '../src/lib/credits.js'
assert.equal(formatDC(1000.25),'1,000.25 DC')
const db=new PGlite(),bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
await db.exec(bootstrap)
await db.exec('alter default privileges in schema public grant all on tables to anon,authenticated')
const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&parseInt(f)<=17).sort()
for(const f of files.filter(f=>parseInt(f)<16))await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
const ids={root:'d1000000-0000-4000-8000-000000000001',finance:'d2000000-0000-4000-8000-000000000002',user:'d3000000-0000-4000-8000-000000000003',other:'d4000000-0000-4000-8000-000000000004'}
const query=async(sql,args=[])=>(await db.query(sql,args)).rows,one=async(sql,args=[])=>(await query(sql,args))[0]
for(const [name,id] of Object.entries(ids)){await db.query('insert into auth.users(id,email) values($1,$2)',[id,name+'@example.org']);if(['root','finance'].includes(name))await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[id,name==='root'?'super_admin':'finance_admin'])}
await db.query('insert into public.points_balance(user_id,balance) values($1,90)',[ids.user]);await db.query("insert into public.points_ledger(user_id,points,reason,ref_key) values($1,40,'daily_checkin','legacy-1'),($1,50,'task:complete-profile','legacy-2')",[ids.user])
const before=await query('select id,user_id,points::text,reason,ref_key,created_at from public.points_ledger order by id')
for(const f of files.filter(f=>parseInt(f)>=16))await db.exec(await readFile('supabase/migrations/'+f,'utf8'))
assert.equal(Number((await one('select balance from public.points_balance where user_id=$1',[ids.user])).balance),90)
const after=await query('select id,user_id,points::text,reason,ref_key,created_at from public.points_ledger order by id');assert.deepEqual(after.map(r=>({...r,points:Number(r.points)})),before.map(r=>({...r,points:Number(r.points)})))
assert.equal((await one("select count(*)::int n from public.dc_transactions where snapshot_origin='reconstructed'")).n,2)
assert.equal(Number((await one('select sum(credit_amount) amount from public.dc_transactions')).amount),90)
async function as(who){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who?ids[who]:'']);await db.exec('set role '+(who?'authenticated':'anon'))}
const wallet=async(kind='transactions',status='',page=0)=>(await one('select public.dc_wallet($1,$2,$3) data',[kind,status,page])).data
const balance=async()=>Number((await wallet()).balance)
await as('user')
for(const sql of ['update public.points_balance set balance=999999','insert into public.points_ledger(points) values(999)','delete from public.dc_transactions','truncate public.dc_transactions','update public.dc_products set cost_dc=1','update public.dc_settings set deposits_enabled=false','update public.payment_transactions set status=\'verified\''])await assert.rejects(db.exec(sql),/permission denied/)
await assert.rejects(one("select public.admin_dc_configure(null,null,null,false,false,'Unauthorized edit')"),/Permission denied/)
await assert.rejects(one("select public.admin_list('dc_transactions')"),/Permission denied/)
await assert.rejects(one("select public.settle_verified_payment('forged',10000,'NGN','user@example.org','fake')"),/permission denied/)
await assert.rejects(one("select public.record_verified_payment_failure('forged',10000,'NGN','user@example.org','fake')"),/permission denied/)
await assert.rejects(one('select public.create_bank_point_order_before_dc($1,$2)',[crypto.randomUUID(),crypto.randomUUID()]),/permission denied/)
await assert.rejects(one('select public.claim_daily_checkin_before_dc()'),/permission denied/)
// Repeated connections do not debit credits or create rewards.
const starting=await wallet()
for(let i=0;i<8;i++){await db.query('insert into public.favourites(user_id,profile_id) values($1,$2)',[ids.user,ids.other]);await db.query('delete from public.favourites where user_id=$1 and profile_id=$2',[ids.user,ids.other])}
assert.equal(await balance(),90);assert.equal((await wallet()).total,starting.total)
await as('other');assert.equal((await wallet()).total,0);assert.equal((await query('select * from public.dc_transactions')).length,0)
await as('root');await assert.rejects(one('select public.admin_save_point_package($1,$2,100,20000,true,$3)',[crypto.randomUUID(),'Invalid conversion','Attempt incorrect rate']),/official_dc_rate/)
const packages=await query('select points,price_kobo from public.point_packages order by points');assert.deepEqual(packages.map(p=>[p.points,p.price_kobo]),[[100,10000],[500,50000],[1000,100000],[5000,500000],[10000,1000000]])
// End-to-end bank request, evidence, finance verification, repeat callback and statement ID reuse.
await as('user');const pack=(await one('select id from public.point_packages where points=100')).id,order=crypto.randomUUID(),receipt=`${ids.user}/${order}/${crypto.randomUUID()}.png`
await one('select public.create_bank_point_order($1,$2)',[pack,order]);assert.equal((await wallet('deposits','pending')).rows[0].credit_amount,0);assert.equal(await balance(),90)
await db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),receipt]);await one('select public.submit_bank_point_order($1,$2,$3,$4)',[order,'Test payer','dc-bank-transfer-1',receipt])
const review=(id,bank='dc-bank-statement-1')=>one('select public.admin_review_bank_order($1,true,$2,$3)',[id,bank,'Confirmed exact amount on receiving bank statement'])
await assert.rejects(review(order),/Permission denied/);await as('other');assert.equal((await query('select * from public.bank_point_orders where id=$1',[order])).length,0)
await as('finance');await review(order);await review(order)
await as('user');assert.equal(await balance(),190);let deposits=await wallet('deposits','successful');assert.equal(deposits.total,1);assert.equal(deposits.rows[0].previous_balance,90);assert.equal(deposits.rows[0].new_balance,190);assert.equal(deposits.rows[0].credit_amount,100)
const second=crypto.randomUUID(),path2=`${ids.user}/${second}/${crypto.randomUUID()}.png`;await one('select public.create_bank_point_order($1,$2)',[pack,second]);await db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),path2]);await one('select public.submit_bank_point_order($1,$2,$3,$4)',[second,'Test payer','dc-bank-transfer-2',path2]);await as('finance');await assert.rejects(review(second),/unique constraint/);await as('user');assert.equal(await balance(),190)
// Provider callbacks: exact kobo conversion, failure, mismatched amount/email/currency, duplicate IDs and retries.
const createPayment=(ref,kobo=12525)=>db.query("insert into public.payment_transactions(user_id,provider,reference,amount_kobo) values($1,'paystack',$2,$3)",[ids.user,ref,kobo])
await createPayment('dc-provider-1');await createPayment('dc-provider-2');await createPayment('dc-provider-failed')
await assert.rejects(db.query("insert into public.payment_transactions(user_id,provider,reference,amount_kobo,purpose) values($1,'paystack','forged-purpose',100,'growth_credits')",[ids.user]),/permission denied/)
await db.exec('reset role;set role service_role')
const settle=(ref='dc-provider-1',amount=12525,currency='NGN',email='user@example.org',id='provider-1')=>one('select public.settle_verified_payment($1,$2,$3,$4,$5)',[ref,amount,currency,email,id])
for(const args of [['dc-provider-1',12500],['dc-provider-1',12525,'USD'],['dc-provider-1',12525,'NGN','other@example.org']])await assert.rejects(settle(...args),/do not match/)
await settle();await settle();await assert.rejects(settle('dc-provider-1',12525,'NGN','user@example.org','different-id'),/does not match/)
await assert.rejects(settle('dc-provider-2'),/unique constraint/)
await one("select public.record_verified_payment_failure('dc-provider-failed',12525,'NGN','user@example.org','failed-id')");await one("select public.record_verified_payment_failure('dc-provider-failed',12525,'NGN','user@example.org','failed-id')")
await as('user');assert.equal(await balance(),315.25);assert.equal((await wallet('deposits','failed')).total,1);assert.equal((await wallet('deposits','successful')).total,2)
// Configured premium request: atomic spend, underfunded denial, request idempotency and refund exactly once.
const product=(await one("select id from public.dc_products where slug='profile_spotlight'")).id
await assert.rejects(one('select public.dc_spend($1,$2,$3)',[product,crypto.randomUUID(),'My profile spotlight request']),/unavailable/)
await as('root');await one('select public.admin_dc_configure($1,100.25,true,null,null,$2)',[product,'Enable staff-fulfilled spotlight requests']);await assert.rejects(one('select public.admin_dc_configure($1,1.234,true,null,null,$2)',[product,'Invalid fractional price']),/two decimal/)
await as('other');await assert.rejects(one('select public.dc_spend($1,$2,$3)',[product,crypto.randomUUID(),'My profile spotlight request']),/Not enough points/)
await as('user');const request=crypto.randomUUID(),spend=()=>one('select public.dc_spend($1,$2,$3)',[product,request,'My profile spotlight request']);await spend();await spend();assert.equal(await balance(),215);await assert.rejects(one('select public.dc_spend($1,$2,$3)',[product,request,'Changed request payload']),/already used/)
await as('other');assert.equal((await query('select * from public.dc_orders')).length,0);await assert.rejects(spend(),/already used/)
await as('finance');await assert.rejects(one('select public.admin_dc_review_order($1,false,$2)',[request,'Feature could not be fulfilled']),/Permission denied/);await one("select public.admin_list('dc_transactions')")
await as('root');await one('select public.admin_dc_review_order($1,false,$2)',[request,'Feature could not be fulfilled']);await one('select public.admin_dc_review_order($1,false,$2)',[request,'Feature could not be fulfilled']);await assert.rejects(one('select public.admin_dc_review_order($1,true,$2)',[request,'Attempt to change final status']),/already been reviewed/)
await as('user');assert.equal(await balance(),315.25);assert.equal((await wallet()).rows.filter(r=>r.transaction_type==='refund').length,1)
const completed=crypto.randomUUID();await one('select public.dc_spend($1,$2,$3)',[product,completed,'A second manual spotlight request']);await as('root');await one('select public.admin_dc_review_order($1,true,$2)',[completed,'Spotlight delivered; publication reference recorded']);await one('select public.admin_dc_review_order($1,true,$2)',[completed,'Spotlight delivered; publication reference recorded']);await as('user');assert.equal(await balance(),215)
// Pauses block new spending/deposits but not settlement of money already received.
await as('root');await one("select public.admin_dc_configure(null,null,null,false,false,'Temporarily pause new economy requests')");await as('user');await assert.rejects(one('select public.create_bank_point_order($1,$2)',[pack,crypto.randomUUID()]),/paused/);await assert.rejects(createPayment('paused-provider'),/paused/);await assert.rejects(one('select public.dc_spend($1,$2,$3)',[product,crypto.randomUUID(),'A paused premium request']),/paused/)
await db.exec('reset role;set role service_role');await settle('dc-provider-2',12525,'NGN','user@example.org','provider-2');await as('user');assert.equal(await balance(),340.25)
await as('root');await one("select public.admin_dc_configure(null,null,null,true,true,'Resume eligible economy requests')")
await one("select public.admin_mutate('configure_reward','daily_checkin_points','{\"value\":0}','Pause daily reward credits',$1)",[crypto.randomUUID()]);await as('user');await assert.rejects(one('select public.claim_daily_checkin()'),/paused/)
await assert.rejects(wallet('transactions','',-1),/Invalid/);await assert.rejects(wallet('withdrawals'),/Invalid/)
// Neither trusted mistakes nor elevated API callers may leave an unreconciled balance or alter the journal.
await db.exec('reset role')
await assert.rejects(db.query('update public.points_balance set balance=balance+1 where user_id=$1',[ids.user]),/matching ledger/)
await assert.rejects(db.query("insert into public.points_ledger(user_id,points,reason,ref_key) values($1,1,'orphan','orphan-ref')",[ids.user]),/matching atomic balance/)
await assert.rejects(db.query('update public.points_balance set balance=null where user_id=$1',[ids.user]),/not-null/);await assert.rejects(db.query('delete from public.points_balance where user_id=$1',[ids.user]),/journaled transaction/);await assert.rejects(db.exec('truncate public.dc_transactions'),/append-only/);
await assert.rejects(db.exec("update public.dc_transactions set description='tampered'"),/append-only/);await assert.rejects(db.exec('delete from public.dc_transactions'),/append-only/)
const rows=await query('select * from public.dc_transactions order by sequence');for(const row of rows)assert.equal(Math.round((Number(row.previous_balance)+Number(row.credit_amount))*100),Math.round(Number(row.new_balance)*100));assert.equal(rows.filter(r=>r.status!=='successful').length,0)
const audit=await one("select count(*)::int n from public.audit_logs where action in ('dc_configuration_saved','dc_request_fulfilled','dc_request_refunded','provider_payment_failed')");assert.ok(audit.n>=6)
await as(null);await assert.rejects(wallet(),/permission denied/);await assert.rejects(one('select public.dc_spend($1,$2,$3)',[product,crypto.randomUUID(),'Unauthorized anonymous request']),/permission denied/)
await db.close();console.log('DC economy PostgreSQL PASS: preserved migration, fixed rate/packages, fractional provider deposits, manual-bank evidence/review, duplicate callbacks/provider IDs, failure states, RLS/ACLs, immutable atomic snapshots, free repeated connections, configured spend/insufficient funds/idempotency, delivered requests/refund, admin audit and pause controls. No live bank/provider/Auth acceptance test was performed.')
