import assert from 'node:assert/strict'
import {feedListingPackages,listingPriceForDays} from '../src/lib/feedListingPackages.js'
assert.deepEqual(feedListingPackages.map(p=>[p.durationHours,p.costDC]),[[7,1200],[24,2400],[48,4600],[72,6800],[168,15600],[336,31000],[504,46400],[720,66200]])
assert.equal(new Set(feedListingPackages.map(p=>p.key)).size,8)
assert.ok(Object.isFrozen(feedListingPackages));assert.ok(feedListingPackages.every(Object.isFrozen))
for(let days=1;days<=30;days++)assert.equal(listingPriceForDays(days),2400+(days-1)*2200)
for(const bad of [0,-1,31,1.5,NaN,Infinity,'7',null,undefined])assert.throws(()=>listingPriceForDays(bad),RangeError)
console.log('PASS feed-listing pricing: fixed owner rates, additional days at 2,200 DC, 7h–30d calculated catalogue; configuration only, not financial enforcement.')
