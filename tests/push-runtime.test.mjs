// Unit tests with explicit network/worker mocks, not real push device delivery.
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile} from 'node:fs/promises'
import {transform} from 'esbuild'
const exports={},module={exports}
const source=await readFile('supabase/functions/_shared/push-utils.ts','utf8'),{code}=await transform(source,{loader:'ts',format:'cjs'})
vm.runInNewContext(code,{exports,module,URL,Date,TextEncoder});const u=module.exports
assert.equal(u.equalSecret('secret','secret'),true);assert.equal(u.equalSecret('',''),false);assert.equal(u.equalSecret('secret','secret2'),false)
for(const [status,outcome] of [[201,'accepted'],[404,'gone'],[410,'gone'],[429,'retry'],[503,'retry'],[0,'retry'],[401,'failed']])assert.equal(u.pushOutcome(status),outcome)
assert.equal(u.retrySeconds('999999'),21600);assert.equal(u.retrySeconds('60'),60);assert.equal(u.retrySeconds('invalid'),0)
for(const url of ['https://fcm.googleapis.com/fcm/send/id','https://web.push.apple.com/token','https://updates.push.services.mozilla.com/wpush/v2/id','https://wns2.notify.windows.com/id'])assert.equal(u.validEndpoint(url),true)
for(const url of ['http://fcm.googleapis.com/id','https://fcm.googleapis.com.evil.example/id','https://127.0.0.1/key','https://evil@fcm.googleapis.com/key','https://fcm.googleapis.com:5555/id'])assert.equal(u.validEndpoint(url),false)
assert.equal(u.safeDestination('https://evil.example/steal','https://danqel.example'),'https://danqel.example/notifications');assert.equal(u.safeDestination('/wallet','https://danqel.example'),'https://danqel.example/wallet')
assert.equal(u.productionMarker({commit:'a'.repeat(40),builtAt:new Date().toISOString()},'a'.repeat(40)),true);assert.equal(u.productionMarker({commit:'a'.repeat(40),builtAt:new Date().toISOString(),sourceDirty:true},'a'.repeat(40)),false);assert.equal(u.productionMarker({commit:'b'.repeat(40),builtAt:new Date().toISOString()},'a'.repeat(40)),false)
assert.equal(u.productionHtml('<meta name="danqel-build" content="'+ 'a'.repeat(40)+'"><script src="/assets/index-test.js"></script>','a'.repeat(40)),true)
// Simulate generated-worker push/click handlers, without a browser/OS or VAPID network.
const handlers={},shown=[],opened=[],origin='https://danqel.example'
const self={location:{origin},addEventListener:(type,fn)=>handlers[type]=fn,registration:{showNotification:async(...args)=>shown.push(args),getNotifications:async()=>[]},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}}
vm.runInNewContext(await readFile('public/push-handler.js','utf8'),{self,URL,Date,Promise,indexedDB:{open:()=>{throw new Error('Simulated blocked storage')}}})
let wait;handlers.push({data:{json:()=>({id:'a0000000-0000-0000-0000-000000000001',title:'A genuine update',body:'Body',url:'https://evil.example'})},waitUntil:p=>wait=p});await wait;assert.equal(shown.length,1);assert.equal(shown[0][1].data.url,origin+'/notifications');assert.equal(shown[0][1].renotify,false)
handlers.notificationclick({notification:{close(){},data:{url:'javascript:alert(1)'}},waitUntil:p=>wait=p});await wait;assert.equal(opened[0],origin+'/notifications')
// Exercise actual Edge handler branching, with trusted external operations replaced.
async function edge(file,globals){let handler;let text=await readFile(file,'utf8');text=text.replace(/^import .*\n/gm,'');const built=await transform(text,{loader:'ts',format:'esm'});vm.runInNewContext(built.code,{...u,Request,Response,URL,Date,JSON,Promise,AbortSignal,Deno:{env:{get:key=>globals.env[key]},serve:fn=>handler=fn},...globals});return handler}
let rpcCalls=[],sent=[],fetches=0
const worker=await edge('supabase/functions/notification-worker/index.ts',{env:{PUSH_CRON_SECRET:'s'.repeat(40),VAPID_PUBLIC_KEY:'pub',VAPID_PRIVATE_KEY:'private-fixture',VAPID_SUBJECT:'mailto:test@example.org'},createClient:()=>({rpc:async(name,args)=>{rpcCalls.push({name,args});return{data:name==='push_claim'?[{id:'job',token:'lease',endpoint:'https://fcm.googleapis.com/fcm/send/id',keys:{},payload:{title:'Test'}}]:true,error:null}}}),webpush:{setVapidDetails(){},sendNotification:async(sub,payload)=>{sent.push({sub,payload});throw{statusCode:410}}}})
assert.equal((await worker(new Request('https://example.org',{method:'POST'}))).status,401);assert.equal(rpcCalls.length,0)
assert.equal((await worker(new Request('https://example.org',{method:'POST',headers:{authorization:'Bearer '+'s'.repeat(40)}}))).status,200);assert.equal(sent.length,1);assert.equal(rpcCalls.at(-1).args.p_outcome,'gone')
const releaseEnv={PRODUCTION_ORIGIN:origin,SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture'}
let releaseCommit='b'.repeat(40),confirmed=0
const publisher=await edge('supabase/functions/publish-app-release/index.ts',{env:releaseEnv,createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'root'}},error:null})},rpc:async name=>{if(name==='confirm_production_release')confirmed++;return{data:name==='mission_staff_access'?true:'release',error:null}}}),fetch:async url=>{fetches++;assert.ok(url.startsWith(origin+'/'));return url.includes('/version.json')?Response.json({version:'1.0.1',commit:releaseCommit,builtAt:new Date().toISOString()}):new Response('<meta name="danqel-build" content="'+releaseCommit+'"><script src="/assets/index-test.js"></script>',{headers:{'Content-Type':'text/html'}})}})
const request=()=>new Request(origin+'/publish',{method:'POST',headers:{origin,authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({commit:'a'.repeat(40),version:'1.0.1',notes:'Useful features and verified fixes.',authorized:true,reason:'Confirm only an independently deployed production release'})})
assert.equal((await publisher(request())).status,409);assert.equal(confirmed,0);releaseCommit='a'.repeat(40);assert.equal((await publisher(request())).status,200);assert.equal(confirmed,1)
console.log('PASS mocked push runtime: endpoint SSRF guards, retry mapping, worker auth/410 revocation, safe SW display/click, and unavailable/mismatched production releases never publish. No real push transport/device test.')
