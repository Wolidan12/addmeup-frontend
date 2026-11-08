import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
const db=new PGlite()
try{
 const boot=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1];await db.exec(boot)
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()')
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort())await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
 const owner=crypto.randomUUID(),finance=crypto.randomUUID(),user=crypto.randomUUID(),other=crypto.randomUUID(),unverified=crypto.randomUUID()
 for(const [id,role] of [[owner,'super_admin'],[finance,'finance_admin'],[user,'user'],[other,'user'],[unverified,'user']]){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id,id+'@example.org',id===unverified?null:new Date()]);if(role!=='user')await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[id,role])}
 await db.query('insert into public.points_balance(user_id,balance) values($1,90)',[user])
 const wallet=async()=>{const role=(await db.query('select current_user r')).rows[0].r;await db.exec('reset role');const value=Number((await db.query('select balance from public.points_balance where user_id=$1',[user])).rows[0]?.balance||0);await db.exec('set role '+role);return value}
 const originalAuth=JSON.stringify((await db.query('select * from auth.users order by id')).rows)
 await db.exec(await readFile('supabase/manual/install_manual_bank_transfers.sql','utf8'));assert.equal(await wallet(),90)
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
 const make=(amount=1000,id=crypto.randomUUID())=>db.query('select public.create_manual_deposit($1,$2) id',[amount,id])
 const review=(id,amount=100000,ref='statement-001',approve=true)=>db.query('select public.admin_confirm_manual_deposit($1,$2,$3,$4,$5,$6,$7)',[id,approve,ref,amount,'NGN','6977298247','Independently checked the receiving bank statement'])
 await as(null);await assert.rejects(make(),/permission denied/)
 await as(unverified);await assert.rejects(make(),/Verify your account/)
 await as(user);for(const amount of [0,-1,0.5,1000001])await assert.rejects(make(amount),/whole naira/)
 const id=crypto.randomUUID();await make(1000,id);await make(1000,id);assert.equal(await wallet(),90)
 await assert.rejects(make(1001,id),/Order ID unavailable/)
 await as(other);await assert.rejects(make(1000,id),/Order ID unavailable/);assert.equal((await db.query('select * from public.bank_point_orders')).rows.length,0)
 await as(user);const path=user+'/'+id+'/'+crypto.randomUUID()+'.png'
 await assert.rejects(db.query('select public.submit_bank_point_order($1,$2,$3,$4)',[id,'Actual payer','reference-001',path]),/Upload payment evidence/)
 // Exercise real storage RLS, not a privileged insertion.
 await db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),path])
 await db.query('select public.submit_bank_point_order($1,$2,$3,$4)',[id,'Actual payer','reference-001',path]);assert.equal(await wallet(),90)
 await assert.rejects(review(id),/Permission denied/)
 await as(owner);await assert.rejects(review(id,99999),/does not match/)
 await review(id);await review(id);assert.equal(await wallet(),1090)
 await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from public.points_ledger where ref_key=$1",['bank-order:'+id])).rows[0].n,1);await as(owner)
 await assert.rejects(review(id,100000,'different-reference'),/prior approval/)
 await assert.rejects(db.query('select public.admin_review_bank_order($1,true,$2,$3)',[id,'bypass-ref','Bypass old approval route']),/permission denied/)
 const report=(await db.query("select public.admin_manual_deposits('Actual payer','approved',0,null,null) data")).rows[0].data;assert.equal(report.total,1);assert.equal(report.gross_kobo,100000);assert.equal(report.rows[0].refunds_supported,false)
 await as(user);const second=(await make()).rows[0].id,p2=user+'/'+second+'/'+crypto.randomUUID()+'.jpg';await db.query("insert into storage.objects(id,bucket_id,name) values($1,'bank-receipts',$2)",[crypto.randomUUID(),p2]);await db.query('select public.submit_bank_point_order($1,$2,$3,$4)',[second,'Actual payer','reference-002',p2]);await as(finance)
 await assert.rejects(review(second),/unique constraint/);assert.equal(await wallet(),1090)
 await review(second,100000,'unused-ref',false);assert.equal(await wallet(),1090)
 await as(finance);const own=(await make()).rows[0].id;await assert.rejects(review(own),/own payment/)
 await as(user);await assert.rejects(db.query("select public.admin_manual_deposits()"),/Permission denied/);await assert.rejects(db.query("update public.points_balance set balance=99999"),/permission denied/)
 await db.exec('reset role');assert.equal(JSON.stringify((await db.query('select * from auth.users order by id')).rows),originalAuth)
 console.log('PASS standalone manual deposits: baseline-only install, real receipt RLS/upload/submit, no credit until authorized statement-matched approval, exact once + bank reference dedup, rejection/no-self-review, ordinary/unverified/anonymous denial, report, original Auth preservation and 90 → 1090 only after approval. Isolated database, not live settlement.')
}finally{await db.close()}
