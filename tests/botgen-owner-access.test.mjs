import assert from 'node:assert/strict'
import {verifyBotOwner,isBotWorkspace} from '../src/admin/botgen/ownerAccess.js'
for(const data of [true,false])assert.equal(await verifyBotOwner({rpc:async name=>{assert.equal(name,'botgen_is_owner');return {data}}}),data)
for(const data of [null,undefined,'true',1,{},[]])await assert.rejects(verifyBotOwner({rpc:async()=>({data})}),/Invalid owner/)
for(const code of ['42501','PGRST202','PGRST301','request_timeout']){let calls=0;await assert.rejects(verifyBotOwner({rpc:async()=>{calls++;return {error:{code}}}}));assert.equal(calls,1)}
assert.equal(isBotWorkspace('/admin/bots'),true)
assert.equal(isBotWorkspace('/admin','?view=bot_generator'),true)
for(const path of ['/admin/login','/admin/bots/login','/dashboard','https://evil.example/admin/bots'])assert.equal(isBotWorkspace(path),false)
assert.equal(isBotWorkspace('/admin','?view=profiles'),false)
console.log('PASS owner access: strict boolean server decision, no role/localStorage/permission-error fallback, owner-only login route selection.')
