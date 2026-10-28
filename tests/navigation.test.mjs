import assert from 'node:assert/strict'
import {loginDestination} from '../src/lib/navigation.js'
assert.equal(loginDestination('/admin?view=site_settings'),'/admin?view=site_settings')
assert.equal(loginDestination('/dashboard'),'/dashboard')
assert.equal(loginDestination('/rewards'),'/rewards')
for(const target of [null,undefined,42,'https://bad.example','//bad.example','/\\bad.example','/login','/login?next=/admin','/register','/reset-password','/\n/bad.example'])assert.equal(loginDestination(target),'/dashboard')
console.log('Dashboard login return paths and external redirect rejection passed')
