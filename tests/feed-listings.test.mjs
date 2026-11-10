import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {listingPayload,readListingRequest,persistListingRequest,listingRequestKey,validateFeedState,listingBalance,verifyListingVisibility} from '../src/lib/feedListings.js'
const user='b0000000-0000-0000-0000-000000000001',id='b0000000-0000-0000-0000-000000000002',pkg={key:'7h',duration_hours:7,cost_dc:1200,label:'7 hours'}
assert.deepEqual(listingPayload(pkg,id),{p_package:'7h',p_request:id,p_expected_cost:1200,p_expected_hours:7})
for(const bad of [{...pkg,cost_dc:0},{...pkg,duration_hours:1},{...pkg,cost_dc:1.2},null])assert.throws(()=>listingPayload(bad,id))
assert.throws(()=>listingPayload(pkg,'fake-id'))
const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}
assert.equal(readListingRequest(user,storage),null)
const request={id,userId:user,packageKey:'7h',cost:1200,hours:7};persistListingRequest(request,user,storage);assert.deepEqual(readListingRequest(user,storage),request)
assert.throws(()=>persistListingRequest({...request,userId:id},user,storage))
map.set(listingRequestKey(user),'{bad');assert.throws(()=>readListingRequest(user,storage),/could not be read/)
const valid={enabled:true,server_now:new Date().toISOString(),purchased_dc:1200,total_dc:5000,profile_ready:true,in_feed:false,active_until:null,packages:[pkg],rows:[],total:0}
assert.equal(validateFeedState(valid,user),valid)
for(const bad of [{purchased_dc:6000},{purchased_dc:-1},{enabled:'yes'},{rows:[{id,user_id:id,starts_at:new Date().toISOString(),ends_at:new Date().toISOString(),status:'active'}]},{packages:[{...pkg,cost_dc:-1}]},{active_until:'bad'}])assert.throws(()=>validateFeedState({...valid,...bad},user))
const sql=await readFile('supabase/manual/install_paid_feed_listings.sql','utf8')
for(const text of ['for update','feed_purchased_dc','feed_preservation','points_ledger','feed-listing:','feed_listing_purchased','ends_at>now()','public.feed_is_active(p.id)','"managed profiles read"','p_expected_cost','p_expected_hours'])assert.ok(sql.includes(text),text)
assert.ok(!/update public\.dc_settings|update auth\.users|grant .*insert.*authenticated/i.test(sql))
for(const file of ['src/pages/Home.jsx','src/pages/MemberDashboard.jsx','src/pages/Discover.jsx'])assert.ok((await readFile(file,'utf8')).includes('useFeedRefresh'),file)
console.log('PASS listing client guards: exact request payload, durable owner-scoped retry ID, corrupt-storage failure, malformed/cross-owner response denial, server guards and all feed surfaces refresh on expiry.')

const funded={...valid,funding_policy:'purchased_or_launch_reward_v1',listing_dc:5000,launch_reward_dc:3800}
assert.equal(validateFeedState(funded,user),funded);assert.equal(listingBalance(funded),5000);assert.equal(listingBalance(valid),1200)
for(const patch of [{listing_dc:6000},{listing_dc:-1},{launch_reward_dc:5000},{funding_policy:'anything'},{listing_dc:'5000'}])assert.throws(()=>validateFeedState({...funded,...patch},user))
const client={rpc:async name=>({data:name==='public_directory'?{rows:[{id:user,managed:false}]}:{id:user}})}
await verifyListingVisibility(client,'member',user)
for(const response of [{data:null},{data:{rows:[]}},{error:{code:'42501'}},{data:{id:user,managed:true,rows:[{id:user,managed:true}]}}])await assert.rejects(verifyListingVisibility({rpc:async()=>response},'member',user),/not confirmed/)
console.log('PASS listing funding guards: validated purchased + launch breakdown, legacy purchased-only fallback, invalid balances denied and same-member public feed/detail verification required.')
