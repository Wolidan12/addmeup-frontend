import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {profileUpdate} from '../src/lib/accountValidation.js'
const baseline={username:'existing_user',display_name:'Existing User',bio:'Original bio',country:'NG',location:'Lagos',interests:['music'],categories:['creator'],is_public:false}
const basic=profileUpdate({...baseline,display_name:' New Name ',bio:'Short intro',country:'NG',interests:' music ',categories:'creator',role:'super_admin',balance:999,is_sponsored:true},baseline)
assert.deepEqual(basic,{display_name:'New Name',bio:'Short intro',is_public:false})
for(const key of ['username','country','location','interests','categories','role','balance','is_sponsored'])assert.ok(!(key in basic),key)
const legacy={...baseline,country:'x'.repeat(100),interests:Array.from({length:12},(_,i)=>'interest'+i)}
assert.deepEqual(profileUpdate({...legacy,display_name:'Basic edit'},legacy),{display_name:'Basic edit',bio:'Original bio',is_public:false})
assert.throws(()=>profileUpdate({...baseline,country:'<script>'},baseline),/country/)
const optional=profileUpdate({...baseline,username:'new_username',country:'GH',location:'Accra',interests:'art,design',categories:'artist'},baseline)
assert.equal(optional.username,'new_username');assert.equal(optional.country,'GH');assert.deepEqual(optional.interests,['art','design'])
assert.equal(profileUpdate({...baseline,location:''},baseline).location,'')
assert.deepEqual(profileUpdate({...baseline,categories:[]},baseline).categories,[])
assert.equal(profileUpdate({...baseline,bio:'',country:'',interests:[]},{...baseline,country:'',interests:[]}).bio,'')
assert.throws(()=>profileUpdate({...baseline,display_name:''},baseline),/display name/)
assert.throws(()=>profileUpdate({...baseline,username:'invalid name'},baseline),/username/)
const settings=await readFile('src/pages/Settings.jsx','utf8'),guide=await readFile('src/pages/HowItWorks.jsx','utf8'),listing=await readFile('src/components/FeedListingInfo.jsx','utf8')
for(const text of ['Country, interests & username','Short bio (needed for launch reward)','launchFocus','Country (needed for launch reward)','Add at least one interest for the launch reward.','baseline.current','profileUpdate(form','inFlight.current','Saving does not buy feed time or deduct DC','Account progress & rewards (optional)'])assert.ok(settings.includes(text),text)
assert.ok(!settings.includes('ExperienceBanner'))
assert.ok(guide.includes('country, interests and other extras are tucked'))
assert.ok(guide.includes('purchased DC or your unspent launch reward'))
assert.ok(listing.includes("supabase.rpc('my_feed_listing'"))
assert.ok(listing.includes("supabase.rpc('buy_feed_listing'"));assert.ok(listing.includes('persistListingRequest'))
console.log('PASS simple profile: basic allowlisted edits, signup username reuse, unchanged optional values omitted, explicit optional edits/clears retained, validation and role/balance protections, no fake listing purchase or free paid-feed claim.')
