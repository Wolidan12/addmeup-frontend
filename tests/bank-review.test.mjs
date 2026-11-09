import assert from 'node:assert/strict'
import {rowActions} from '../src/admin/resources.js'
import {bankReviewPayload} from '../src/admin/bankReview.js'
const row={id:'test-order',status:'submitted',amount_kobo:10000,points:100,account_number:'6977298247',transfer_reference:'USER-CLAIM-NOT-A-STATEMENT-ID'}
const args={approve:true,reference:'BANK-STATEMENT-123',confirmed:true}
assert.throws(()=>bankReviewPayload(row,{...args,confirmed:false}),/checked/)
assert.throws(()=>bankReviewPayload(row,{...args,reference:''}),/statement/)
assert.throws(()=>bankReviewPayload({...row,status:'approved'},args),/no longer/)
for(const change of [{amount_kobo:-100},{points:200},{account_number:'1234567890'},{amount_kobo:NaN},{amount_kobo:10001,points:100.01},{amount_kobo:100000100,points:1000001}])assert.throws(()=>bankReviewPayload({...row,...change},args),/needs review/)
const payload=bankReviewPayload(row,args);assert.equal(payload.p_received_kobo,10000);assert.equal(payload.p_currency,'NGN');assert.equal(payload.p_recipient,'6977298247');assert.equal(payload.p_bank_reference,'BANK-STATEMENT-123');assert.ok(!payload.p_reason.includes(row.transfer_reference))
assert.throws(()=>bankReviewPayload(row,{approve:false}),/Choose a reason/)
assert.throws(()=>bankReviewPayload(row,{approve:false,declineReason:'other',note:'short'}),/eight/)
const declined=bankReviewPayload(row,{approve:false,declineReason:'receipt_invalid'});assert.equal(declined.p_approve,false);assert.equal(declined.p_received_kobo,null);assert.equal(declined.p_bank_reference,null);assert.ok(declined.p_reason.length>=8)
assert.throws(()=>bankReviewPayload(row,{...args,note:'x'.repeat(801)}),/800/)
console.log('PASS compact bank review: explicit independent statement confirmation/reference required, no reuse of member reference, amount/account validation, short audited decline reasons; original backend payload retained.')

for(const role of ['super_admin','finance_admin']){assert.deepEqual(rowActions('bank_point_orders',{status:'submitted'},role).map(a=>a.label),['Approve','Decline']);assert.equal(rowActions('bank_point_orders',{status:'submitted',is_self:true},role).length,0)}
for(const role of ['user','moderator','support_agent'])assert.equal(rowActions('bank_point_orders',{status:'submitted'},role).length,0)
