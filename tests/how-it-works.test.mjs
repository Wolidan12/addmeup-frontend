import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(p,'utf8')
const guide=await read('src/pages/HowItWorks.jsx')
for(const text of ['Create your profile','Add your social links','Make your listing discoverable','ILLUSTRATIVE SAMPLE · NOT A REAL MEMBER','Nothing you try here is saved','Allow my profile to be public','Save social link','Preview profile','No real connection, DC or XP changed','not identity verification','receipt alone is not approval','₦1 = 1 DC'])assert.ok(guide.includes(text),text)
assert.ok(!/supabase|\.rpc\(|localStorage|sessionStorage|<ProfileCard|fetch\(/.test(guide),'Tutorial must not create records or masquerade as a directory profile')
assert.match(guide,/aria-pressed=\{connected\}/)
assert.match(guide,/aria-live="polite"/)
for(const file of ['src/App.jsx','src/pages/Home.jsx','src/member/MemberLayout.jsx','src/components/chrome.jsx','src/components/GettingStarted.jsx'])assert.ok((await read(file)).includes('/how-it-works'),file)
assert.ok((await read('src/pages/MemberDashboard.jsx')).includes('<GettingStarted/>'))
console.log('PASS beginner guide: public/member route entry points, explicit fictional sample, real profile/link visibility instructions, free connection/credit safety copy and no tutorial storage/network mutation.')
