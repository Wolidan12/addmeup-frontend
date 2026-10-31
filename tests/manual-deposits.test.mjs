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
 cluster=new EmbeddedPostgres({databaseDir:directory,port:55440,user:'postgres',password:'isolated-test-only',persistent:false,onLog:()=>{},onError:()=>{},postgresFlags:['-c','listen_addresses=127.0.0.1','-c','max_connections=100']})
 await cluster.initialise();await cluster.start();const client=cluster.getPgClient();await client.connect();db={query:(...args)=>client.query(...args),exec:sql=>client.query(sql),close:()=>client.end()};factory=async()=>{const c=cluster.getPgClient();await c.connect();return c}
}else db=new PGlite()
try{await exercise()}finally{await db.close();if(cluster)await cluster.stop()}
async function exercise(){
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
 await db.exec(bootstrap);await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now(),add column raw_user_meta_data jsonb default '{}'::jsonb;alter default privileges in schema public grant all on tables to anon,authenticated")
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0]
 const root=crypto.randomUUID(),user=crypto.randomUUID(),other=crypto.randomUUID()
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
 for(const id of [root,user,other])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.org'])
 await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[root])
 const balance=async()=>Number((await one('select public.dc_wallet() data')).data.balance)
 const create=(amount,id=crypto.randomUUID())=>one('select public.create_manual_deposit($1,$2) id',[amount,id])
 const review=(id,amount,currency='NGN',account='6977298247',ref='stmt-'+id)=>one('select public.admin_confirm_manual_deposit($1,true,$2,$3,$4,$5,$6)',[id,ref,amount*100,currency,account,'Independently confirmed cleared funds on receiving bank statement'])
 async function submit(id){await db.exec('reset role');const path=user+'/'+id+'/'+crypto.randomUUID()+'.png';await db.query("insert into storage.objects(bucket_id,name) values('bank-receipts',$1)",[path]);await as(user);await one('select public.submit_bank_point_order($1,$2,$3,$4)',[id,'Original Payer','claimed-'+id,path])}
 await as(user);assert.equal(await balance(),0)
 for(const value of [0,-100,1000001,1.001])await assert.rejects(create(value),/Enter a naira amount/)
 const orders=[]
 for(const amount of [100,1000,5000]){
  const id=crypto.randomUUID();orders.push(id);assert.equal((await create(amount,id)).id,id);assert.equal((await create(amount,id)).id,id)
  const before=await balance();await submit(id);assert.equal(await balance(),before)
  await assert.rejects(review(id,amount),/Permission denied/)
  await as(root);await assert.rejects(review(id,amount+1),/does not match/);await assert.rejects(review(id,amount,'USD'),/does not match/);await assert.rejects(review(id,amount,'NGN','0000000000'),/does not match/)
  await review(id,amount);await review(id,amount);await assert.rejects(review(id,amount,'NGN','6977298247','contradictory-statement-id'),/reference does not match/)
  await as(user);assert.equal(await balance(),before+amount)
 }
 assert.equal(await balance(),6100)
 const rejected=(await create(100)).id;await submit(rejected);await as(root);await one("select public.admin_confirm_manual_deposit($1,false,null,null,null,null,'Transfer not found on actual receiving bank statement')",[rejected]);await as(user);assert.equal(await balance(),6100)
 const mismatch=(await create(100)).id;await submit(mismatch);await as(root);await assert.rejects(review(mismatch,100,'NGN','6977298247','stmt-'+orders[0]),/unique constraint/)
 await assert.rejects(one('select public.admin_review_bank_order($1,true,$2,$3)',[mismatch,'bank-ref','Attempt old approval without bank confirmation']),/Use bank statement/)
 await as(other);assert.equal((await one('select count(*)::int n from public.bank_point_orders')).n,0)
 await assert.rejects(one("select public.admin_manual_deposits('', '',0,null,null)"),/Permission denied/)
 await as(root);let result=(await one("select public.admin_manual_deposits($1,'',0,null,null) data",[user+'@example.org'])).data;assert.equal(result.total,5);assert.equal(Number(result.gross_kobo),610000)
 const refund=()=>one('select public.admin_record_manual_refund($1,$2,10000,$3)',[orders[0],'external-refund-100','Independently confirmed outgoing bank refund to original payer'])
 await refund();await refund();await as(user);assert.equal(await balance(),6000);assert.equal((await one("select public.dc_wallet('deposits','refunded',0) data")).data.total,1)
 await as(root);assert.equal((await one("select public.admin_manual_deposits('', '',0,'2099-01-01','2099-12-31') data")).data.total,0)
 await one("select public.admin_mutate('adjust_points',$1,'{\"points\":-5500}'::jsonb,'Isolated unspent-credit refund boundary test',$2)",[user,crypto.randomUUID()]);await assert.rejects(one("select public.admin_record_manual_refund($1,'insufficient-reversal',100000,'Confirmed refund requires recovery of credits first')",[orders[1]]),/Insufficient unspent/);await as(user);assert.equal(await balance(),500);await as(root);await one("select public.admin_mutate('adjust_points',$1,'{\"points\":5500}'::jsonb,'Restore isolated refund boundary test funds',$2)",[user,crypto.randomUUID()])
 await as(root);result=(await one("select public.admin_manual_deposits('', '',0,null,null) data")).data;assert.equal(Number(result.refunded_kobo),10000);assert.equal(Number(result.net_kobo),600000)
 await assert.rejects(one("select public.admin_record_manual_refund($1,'partial-refund',1,'A partial refund is unsupported and must not reverse credits')",[orders[1]]),/exact full/)
 const own=(await create(100)).id;await assert.rejects(review(own,100),/own payment/)
 await db.exec('reset role');await assert.rejects(db.query("insert into public.payment_transactions(user_id,provider,reference,amount_kobo) values($1,'paystack','disabled-provider',10000)",[user]),/Online payments are disabled/)
 await db.exec('set role service_role');await assert.rejects(one("select public.settle_verified_payment('disabled-provider',10000,'NGN','someone@example.org','123')"),/permission denied/)
 await as(user);await assert.rejects(db.exec("update public.bank_point_orders set status='approved'"),/permission denied/)
 await assert.rejects(one("select public.admin_review_bank_order_before_dc($1,true,'fake-bank','Untrusted legacy approval attempt')",[mismatch]),/permission denied/)
 if(factory){
  const session=async(id,sql,args)=>{const c=await factory();try{await c.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await c.query('set role authenticated');return(await c.query(sql,args)).rows[0]}finally{await c.end()}}
  await Promise.all(Array.from({length:20},()=>session(root,"select public.admin_confirm_manual_deposit($1,true,'concurrent-cleared-reference',10000,'NGN','6977298247','Independently confirmed receiving bank statement transfer')",[mismatch])))
  await as(user);assert.equal(await balance(),6100)
  await Promise.all(Array.from({length:20},()=>session(root,"select public.admin_record_manual_refund($1,'concurrent-outgoing-refund',10000,'Confirmed full outgoing refund independently on bank statement')",[mismatch])))
  await as(user);assert.equal(await balance(),6000)
  const pending=(await create(100)).id;await submit(pending)
  const race=await Promise.allSettled([session(root,"select public.admin_confirm_manual_deposit($1,true,'approve-vs-reject',10000,'NGN','6977298247','Confirmed cleared funds independently')",[pending]),session(root,"select public.admin_confirm_manual_deposit($1,false,null,null,null,null,'No cleared bank transfer was found')",[pending])]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1)
  console.log('PASS real PostgreSQL: 20 concurrent approvals, 20 concurrent full-refund reversals, conflicting approve/reject serialize with one winner')
 }
 await db.exec('reset role');const buyer=crypto.randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[buyer,buyer+'@example.org']);await db.exec("update public.reward_config set value=10 where key='referral_purchase_percent'")
 await as(other);await one('select public.member_overview()');await as(buyer);await one('select public.apply_referral($1)',['DQ-'+other.replaceAll('-','')]);const referred=(await create(100)).id
 await db.exec('reset role');const path=buyer+'/'+referred+'/'+crypto.randomUUID()+'.png';await db.query("insert into storage.objects(bucket_id,name) values('bank-receipts',$1)",[path]);await as(buyer);await one('select public.submit_bank_point_order($1,$2,$3,$4)',[referred,'Referred Payer','referred-claim-reference',path]);await as(root);await review(referred,100);await as(other);assert.equal(await balance(),0)
 // Historical purchase bonuses are preserved, but must reverse if their original deposit is refunded.
 await db.exec('reset role');await db.exec('begin');await db.query('update public.points_balance set balance=balance+10 where user_id=$1',[other]);await db.query("insert into public.points_ledger(user_id,points,reason,ref_key) values($1,10,'Historical referral purchase reward',$2)",[other,'referral-purchase:'+referred]);await db.query('insert into public.referral_purchase_rewards(order_id,referrer_id,referred_id,points,percent) values($1,$2,$3,10,10)',[referred,other,buyer]);await db.exec('commit');await as(other);assert.equal(await balance(),10);await as(root);await one("select public.admin_record_manual_refund($1,'external-referred-refund',10000,'Confirmed external refund and associated referral reward reversal')",[referred]);await as(other);assert.equal(await balance(),0);await as(buyer);assert.equal(await balance(),0)
 console.log('PASS manual deposits: 100/1000/5000 NGN exact DC, pending receipt gives no credit, rejected transfer, amount/currency/recipient mismatch, duplicate references/review, full refund once, private RLS, staff search/totals, retired provider writes and privileged legacy calls denied')
}
