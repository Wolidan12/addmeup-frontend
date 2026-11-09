import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {relationshipMessage} from '../src/lib/connectionRewards.js'
const script=await readFile('public/theme-init.js','utf8')
for(const [saved,expected] of [[null,'dark'],['light','light'],['dark','dark'],['tampered','dark']]){
 const meta={},html={dataset:{},style:{}};vm.runInNewContext(script,{localStorage:{getItem:()=>saved},document:{documentElement:html,querySelector:()=>meta}});assert.equal(html.dataset.theme,expected);assert.equal(html.style.colorScheme,expected);assert.equal(meta.content,expected==='light'?'#ffffff':'#07080c')
}
const html={dataset:{},style:{}};assert.doesNotThrow(()=>vm.runInNewContext(script,{localStorage:{getItem:()=>{throw Error('Unavailable')}},document:{documentElement:html,querySelector:()=>null}}));assert.equal(html.dataset.theme,'dark')
const index=await readFile('index.html','utf8');assert.ok(index.indexOf('/theme-init.js')<index.indexOf('/src/main.jsx'),'Preference is applied before React')
const before=await readFile('src/design/light.generated.css','utf8');execFileSync(process.execPath,['scripts/build-light-theme.mjs']);assert.equal(await readFile('src/design/light.generated.css','utf8'),before,'Generated stylesheet is current and deterministic')
assert.ok(before.includes('--ad-bg:#ffffff'));assert.ok(before.includes('--ds-bg:#ffffff'));assert.ok(before.includes('.auth-atelier'));assert.ok(before.includes('.member-shell'));assert.ok(before.includes('.how-guide'));assert.ok(!before.includes('.botgen-'))
const main=await readFile('src/main.jsx','utf8');assert.ok(main.includes('<ThemeProvider><ErrorBoundary><App/><AppUpdate/></ErrorBoundary><ThemeToggle/></ThemeProvider>'))
assert.match(relationshipMessage({action:'connect',enabled:true,reward_dc:7,reward_status:'granted'}),/\+7 reward DC/)
for(const reward_status of ['already_processed','daily_cap','paused',undefined])assert.doesNotMatch(relationshipMessage({action:'connect',enabled:true,reward_dc:0,reward_status}),/\+7 reward DC/)
assert.match(relationshipMessage({action:'connect',enabled:true,reward_status:'daily_cap'}),/50 rewarded connections/)
assert.match(relationshipMessage({action:'connect',enabled:false}),/reconnecting/)
assert.match(relationshipMessage({action:'save',enabled:true}),/does not earn/)
console.log('PASS pre-paint persisted/default/storage-unavailable themes, deterministic all-route light CSS, globally mounted accessible toggle, and server-only reward outcome messages')
