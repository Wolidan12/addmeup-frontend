import assert from 'node:assert/strict'
import {verifyManagedPublication} from '../src/lib/managedPublication.js'
const id='d0000000-0000-0000-0000-000000000001',record={id,username:'creator',is_public:true},calls=[]
const client={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='public_directory'?{rows:[{id,managed:true}]}:{id,managed:true}}}}
await verifyManagedPublication(client,[record]);assert.equal(calls[0].args.p_search,'@creator');assert.equal(calls[1].args.p_managed,true)
calls.length=0;await verifyManagedPublication(client,[{...record,is_public:false}]);assert.equal(calls.length,0)
for(const response of [{data:null},{data:{rows:[]}},{error:{code:'42501'}},{data:{id,managed:false,rows:[{id,managed:false}]}},{data:{id:'other',managed:true,rows:[{id:'other',managed:true}]}}])await assert.rejects(verifyManagedPublication({rpc:async()=>response},[record]),/not confirmed/)
console.log('PASS admin publication confirmation: both actual feed and managed profile page required, exact handle search, ID/type checks, private drafts do not trigger public reads, denied/malformed/missing results never claim publication.')
