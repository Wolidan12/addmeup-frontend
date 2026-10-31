// Online payments are deliberately retired; test absence of processing, not provider success.
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {transform} from 'esbuild'
import vm from 'node:vm'
const exports={},module={exports}
const source=await readFile('supabase/functions/_shared/manual-only.ts','utf8')
const {code}=await transform(source,{loader:'ts',format:'cjs'})
vm.runInNewContext(code,{exports,module,Response,fetch:()=>{throw new Error('Provider network access forbidden')}})
for(const method of ['POST','GET']){const response=module.exports.manualOnly(new Request('https://example.org',{method}));assert.equal(response.status,410);assert.match((await response.json()).error,/Online payments are disabled/)}
assert.equal(module.exports.manualOnly(new Request('https://example.org',{method:'OPTIONS'})).status,204)
assert.ok(!/Deno\.env|fetch\(|\.rpc\(/.test(source))
for(const path of ['src/pages/Commerce.jsx','src/admin/ActionDialog.jsx'])assert.ok(!(await readFile(path,'utf8')).includes("invoke('verify-payment'"))
for(const endpoint of ['verify-payment','payment-webhook'])assert.match(await readFile(`supabase/functions/${endpoint}/index.ts`,'utf8'),/Deno.serve\(manualOnly\)/)
console.log('Retired online-payment endpoints PASS: HTTP 410, no secret reads, no network/database calls, no verification action.')

// Prevent accidentally restoring a test/live provider adapter alongside the tombstones.
const {readdir}=await import('node:fs/promises')
async function walk(root){const files=[];for(const item of await readdir(root,{withFileTypes:true})){const path=root+'/'+item.name;if(item.isDirectory())files.push(...await walk(path));else files.push(path)}return files}
for(const path of [...await walk('src'),...await walk('supabase/functions')]){
 const text=await readFile(path,'utf8')
 assert.ok(!/api\.paystack\.co|checkout\.paystack\.com|PAYSTACK_(?:TEST_)?SECRET_KEY|paystack_test_/i.test(text),path+': provider integration must remain absent')
}
assert.ok(!(await readdir('supabase/migrations')).some(f=>f.includes('paystack_test')))
const {scripts}=JSON.parse(await readFile('package.json','utf8'));assert.ok(!scripts['test:paystack-sandbox'])
console.log('Manual-only source guard PASS: no Paystack API/checkout/secret/sandbox integration in browser or Edge sources.')
