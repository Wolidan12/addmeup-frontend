import assert from 'node:assert'
assert.match('amara_1',/^[a-z0-9_]{3,24}$/); assert.ok(!/^[a-z0-9_]{3,24}$/.test('Bad Name!'))
assert.equal(encodeURIComponent('2348000000000'),'2348000000000')
console.log('validation tests passed')
