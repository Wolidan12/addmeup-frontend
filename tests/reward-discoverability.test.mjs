import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [app, rewards, notifications, nav, gettingStarted, promotion, settings] = await Promise.all([
  readFile('src/App.jsx', 'utf8'),
  readFile('src/pages/Rewards.jsx', 'utf8'),
  readFile('src/pages/ActivityCenter.jsx', 'utf8'),
  readFile('src/member/MemberLayout.jsx', 'utf8'),
  readFile('src/components/GettingStarted.jsx', 'utf8'),
  readFile('src/components/LaunchPromotion.jsx', 'utf8'),
  readFile('src/pages/Settings.jsx', 'utf8'),
])

assert.match(app, /path="\/rewards"[\s\S]{0,220}<Rewards\s*\/>/)
assert.match(rewards, /import LaunchPromotion from ['"]\.\.\/components\/LaunchPromotion['"]/)
assert.match(rewards, /mode==='all'&&<LaunchPromotion profile=\{data\?\.profile\} onAward=\{changed\}\/>/)
assert.match(notifications, /!rankings && <LaunchPromotion compact profile=\{data\?\.profile\} onAward=\{refresh\} \/>/)
assert.match(nav, /\['\/rewards','5,000 DC launch reward',Gift\]/)
assert.match(gettingStarted, /<Link to="\/rewards"><Gift size=\{17\} \/> Find my 5,000 DC launch reward<\/Link>/)
assert.match(gettingStarted, /Confirm your email, add a photo, bio, country and one interest/)
assert.match(settings, /first-50 5,000 DC launch reward/)
assert.match(settings, /Country, interests & username/)
assert.match(settings, /open=\{launchFocus\}/)
assert.doesNotMatch(settings, /extra details are optional|Country, location, interests and categories are optional/)
assert.match(promotion, /display name, username, photo, bio, country and at least one interest/)
assert.match(promotion, /missingProfileRequirements/)
assert.match(promotion, /Still needed for the launch reward/)
assert.match(promotion, /settings\?launch=1/)

// Discoverability is client-side only: the existing private, server-authoritative APIs still decide eligibility and award.
assert.match(promotion, /supabase\.rpc\('launch_status'\)/)
assert.match(promotion, /supabase\.rpc\('claim_launch_reward'\)/)
assert.match(promotion, /credited automatically when requirements are met/)
assert.match(promotion, /Check & receive 5,000 DC if eligible/)
assert.doesNotMatch(promotion, /activity_reference/)

console.log('PASS reward discoverability: dedicated Rewards route, new-member link, notification-center entry, and existing server-side eligibility/award RPCs remain authoritative.')
