import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {approvedDepositBank,loadDepositBank} from '../src/member/depositBank.js'
const calls=[]
function client(result){const q={select(v){calls.push(['select',v]);return q},eq(k,v){calls.push(['eq',k,v]);return q},single(){return Promise.resolve(result)}};return {from(t){calls.push(['from',t]);return q}}}
assert.deepEqual(await loadDepositBank(client({data:approvedDepositBank})),approvedDepositBank)
assert.ok(calls.some(c=>c[0]==='from'&&c[1]==='bank_transfer_details'))
for(const data of [null,{...approvedDepositBank,account_number:'6985263361'},{...approvedDepositBank,account_name:'Different beneficiary'},{...approvedDepositBank,bank_name:'Other bank'}])await assert.rejects(loadDepositBank(client({data})),/owner review/)
await assert.rejects(loadDepositBank(client({error:{code:'42501'}})))
const page=await readFile('src/pages/Deposit.jsx','utf8');assert.match(page,/Do not transfer just because/);assert.match(page,/navigator.clipboard/);assert.ok(!page.includes("rpc('"),'page itself must not perform financial writes')
const app=await readFile('src/App.jsx','utf8');assert.match(app,/path="\/deposit" element={<Guard><Deposit\/><\/Guard>}/)
console.log('PASS dedicated deposit route: protected route, confirmed Moniepoint destination, no default bank on read failure/mismatch, copy fallback and no financial writes from reference page.')
