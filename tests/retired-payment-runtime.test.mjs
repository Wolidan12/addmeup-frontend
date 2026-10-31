import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const source=await readFile('supabase/functions/_shared/manual-only.ts','utf8')
const {manualOnly}=await import('data:text/javascript;base64,'+Buffer.from(source.replace(': Request','').replace(': Response','')).toString('base64'))
for(const method of ['GET','POST','PUT','DELETE','OPTIONS']){const response=manualOnly(new Request('https://example.org/retired',{method,...(method==='POST'?{body:JSON.stringify({status:'success',amount:100000,reference:'untrusted-payment-claim'})}:{})}));assert.equal(response.status,method==='OPTIONS'?204:410);if(method!=='OPTIONS')assert.match((await response.json()).error,/Online payments are disabled/)}
assert.ok(!/Deno\.env|supabase\.from|\.rpc\(|fetch\(/.test(source))
console.log('PASS retired payment runtime: all methods fail closed, forged success payload ignored, OPTIONS only, no provider/database/secret access. Live GET separately checked; not a live POST crediting test.')
