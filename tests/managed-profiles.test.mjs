import assert from 'node:assert/strict'
import {newManagedDraft,prepareManagedBatch,prepareManagedEdit} from '../src/lib/managedProfiles.js'
const draft={...newManagedDraft(),username:'creator_one',display_name:'Creator One',links:{whatsapp:'+234 801 234 5678',instagram:'instagram.com/creator_one'}}
const out=prepareManagedBatch([draft]);assert.equal(out[0].is_public,false);assert.equal(out[0].social_links[0].url,'https://wa.me/2348012345678')
assert.throws(()=>prepareManagedBatch([draft,draft]),/appears twice/)
assert.throws(()=>prepareManagedBatch([{...draft,username:'Bad Username'}]),/Profile 1/)
assert.throws(()=>prepareManagedBatch([{...draft,links:{instagram:'https://evil.example/creator'}}]),/official instagram/)
assert.throws(()=>prepareManagedBatch([]),/between 1 and 25/)
assert.throws(()=>prepareManagedBatch(Array.from({length:26},(_,i)=>({...draft,username:'user_'+i}))),/between 1 and 25/)
console.log('Managed draft validation, duplicate/limit checks, safe link normalization and private-by-default visibility passed')

assert.equal(prepareManagedBatch([{...draft,links:{facebook:'https://fb.com/creator'}}])[0].social_links[0].url,'https://www.facebook.com/creator')

const edit=prepareManagedEdit({...draft,interests:'music',is_public:false},{instagram:'instagram.com/creator_one',facebook:'https://fb.com/creator'},[{platform:'instagram',is_public:false}])
assert.equal(edit.is_public,false)
assert.equal(edit.social_links.find(l=>l.platform==='instagram').is_public,false)
assert.equal(edit.social_links.find(l=>l.platform==='facebook').url,'https://www.facebook.com/creator')
assert.throws(()=>prepareManagedEdit({...draft,interests:''},{instagram:'https://evil.example/name'}),/official instagram/)
console.log('Single managed edit shares validation/normalization and preserves private social-link visibility')
