import assert from 'node:assert/strict'
import {publicError,withTimeout} from '../src/lib/errors.js'
const secret='PRIVATE_TEST_SENTINEL_SQL_INTERNAL'
assert.equal(publicError(new Error(secret)),'We could not complete that action. Please try again.')
assert.equal(publicError({message:secret,code:'invalid_credentials'}),'The email or password is incorrect. Please try again.')
assert.equal(publicError({code:'23505',message:secret}),'That information is already in use or has already been submitted. Please check and try again.')
assert.equal(publicError({message:'Already checked in today: '+secret}),'You have already claimed today’s check-in. Come back tomorrow.')
assert.equal(await withTimeout(Promise.resolve('ok'),100),'ok')
await assert.rejects(withTimeout(Promise.reject(new Error('rejected')),100),/rejected/)
await assert.rejects(withTimeout(new Promise(()=>{}),5),e=>e.code==='request_timeout')
console.log('Error allowlist, raw-detail suppression, resolution/rejection and bounded timeout passed')
