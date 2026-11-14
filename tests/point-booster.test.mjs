import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {resources,canView,rowActions} from '../src/admin/resources.js'

const [layout,nav,app,page,admin,programme]=await Promise.all([
 readFile('src/member/MemberLayout.jsx','utf8'),
 readFile('src/components/WorkspaceNav.jsx','utf8'),
 readFile('src/App.jsx','utf8'),
 readFile('src/pages/Boosters.jsx','utf8'),
 readFile('src/pages/Admin.jsx','utf8'),
 readFile('src/admin/ProgrammeDialog.jsx','utf8'),
])
const packageResource=resources.find(resource=>resource.key==='boost_plans')
assert.ok(packageResource)
assert.equal(canView('super_admin',packageResource),true,'Super Admin can access booster-package configuration')
assert.equal(canView('finance_admin',packageResource),false,'Financial review roles cannot change reward multipliers')
assert.equal(rowActions('boost_plans',{id:'plan'},'super_admin')[0].action,'edit_boost')
assert.match(layout,/\['\/reward-boosts','Points boost',Flame\]/,'The five-item mobile Points boost tab opens reward booster packages, not paid promotions')
assert.match(layout,/<Link to="\/reward-boosts">Explore boosters/)
assert.match(nav,/\['\/reward-boosts','Points boost',Flame\]/)
assert.match(app,/path="\/reward-boosts" element=\{<Guard><Boosters\/>/)
assert.match(app,/path="\/boosts"[\s\S]*?<BoostCenter\s*\/>/,'Paid placements remain separate from reward multipliers')
assert.match(page,/supabase\.from\('boost_plans'\)/)
assert.match(page,/activate_point_boost/)
assert.match(page,/connection rewards are not multiplied/i)
assert.match(page,/admin\?view=boost_plans/,'Super Admins get a direct package-management link from the member page')
assert.match(admin,/boost_plans/)
assert.match(programme,/admin_save_boost_plan/)
assert.match(programme,/Maximum extra DC/)
console.log('PASS points booster route, existing capped reward mechanics, Super Admin package access, finance-role exclusion, and separate paid-promotion route.')
