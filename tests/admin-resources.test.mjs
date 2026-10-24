import {validSocialUrl} from '../src/lib/validation.js'
import {readFile} from 'node:fs/promises'
import {validateImage,MAX_IMAGE_BYTES} from '../src/lib/imageValidation.js'
import assert from 'node:assert/strict'
import {resources,canView,rowActions,csv} from '../src/admin/resources.js'
assert.equal(canView('finance_admin',resources.find(r=>r.key==='profiles')),false)
assert.equal(canView('support_agent',resources.find(r=>r.key==='payment_transactions')),false)
assert.equal(rowActions('profiles',{},'support_agent').some(a=>a.action==='restrict'),false)
assert.equal(rowActions('profiles',{},'super_admin').some(a=>a.action==='adjust_points'),true)
assert.equal(rowActions('payment_transactions',{status:'verified',provider:'paystack'},'finance_admin').length,0)
assert.equal(rowActions('payment_transactions',{status:'pending',provider:'paystack'},'finance_admin')[0].action,'verify_payment')
assert.equal(csv([{name:'=HYPERLINK("bad")',note:'line\nbreak'}],['name','note']),`"name","note"\r\n"'=HYPERLINK(""bad"")","line\nbreak"`)
assert.equal(new Set(resources.map(r=>r.key)).size,resources.length)
console.log('Admin resource permissions, action availability and CSV safety tests passed')

assert.equal(validateImage({type:'image/png',size:100}),'png')
assert.equal(validateImage({type:'image/jpeg',size:MAX_IMAGE_BYTES}),'jpg')
assert.throws(()=>validateImage({type:'image/svg+xml',size:100}),/JPG, PNG or WebP/)
assert.throws(()=>validateImage({type:'image/png',size:MAX_IMAGE_BYTES+1}),/5 MB/)
assert.throws(()=>validateImage({type:'image/png',size:0}),/empty/)
assert.equal(rowActions('bank_point_orders',{status:'submitted'},'moderator').length,0)
assert.equal(rowActions('bank_point_orders',{status:'submitted'},'finance_admin').length,2)
assert.equal(rowActions('bank_point_orders',{status:'approved'},'finance_admin').length,0)
assert.equal(rowActions('managed_profiles',{},'super_admin')[0].action,'edit_listing')
console.log('Image validation and manual-payment action permissions passed')

assert.equal(validSocialUrl('instagram','https://instagram.com/example'),true)
assert.equal(validSocialUrl('instagram','https://instagram.com.attacker.example/example'),false)
assert.equal(validSocialUrl('instagram','http://instagram.com/example'),false)
assert.equal(validSocialUrl('whatsapp','https://wa.me/2348000000000'),true)
assert.equal(rowActions('boost_plans',{},'super_admin')[0].action,'edit_boost')
assert.equal(rowActions('site_settings',{},'support_agent').length,0)
for(const file of ['src/pages/Home.jsx','src/pages/Discover.jsx','src/pages/ProfileDetail.jsx','src/components/chrome.jsx','src/pages/AuthPages.jsx']){
 const source=await readFile(file,'utf8')
 assert.ok(!source.includes('DEMO_PROFILES'))
 assert.ok(!source.includes('Live — connected'))
 assert.ok(!source.includes('Demo mode'))
}
console.log('Social URL validation, site-control permissions and demo-removal checks passed')
