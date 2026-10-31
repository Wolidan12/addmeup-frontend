import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {verifyProduction} from '../scripts/verify-production.mjs'
const marker=JSON.parse(await readFile('dist/version.json','utf8'));assert.equal(typeof marker.sourceDirty,'boolean')
const manifest=JSON.parse(await readFile('dist/manifest.webmanifest','utf8'))
assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.theme_color,'#07080c')
const source=await readFile('src/components/AppUpdate.jsx','utf8');assert.ok(!source.includes('react-router-dom'),'Update UI mounts outside the router; use a safe anchor')
assert.ok((await readFile('src/main.jsx','utf8')).includes('<ErrorBoundary>'))
const html=await readFile('dist/index.html','utf8');assert.ok(html.includes('apple-touch-icon'));assert.ok(html.includes('viewport-fit=cover'))
const render=await readFile('render.yaml','utf8');assert.ok(render.includes('staticPublishPath: dist'));assert.ok(render.includes('npm ci && npm run build'));assert.ok(render.includes('destination: /index.html'));assert.ok(render.includes('max-age=31536000, immutable'));assert.ok(render.includes('Permissions-Policy'))
const {ready,checks}=await verifyProduction('https://example.org',async()=>new Response('<html>Wrong SPA fallback</html>',{headers:{'content-type':'text/html'}}));assert.equal(ready,false);assert.ok(checks.some(c=>c.name==='manifest'&&!c.ok));assert.ok(checks.some(c=>c.name==='worker'&&!c.ok))
await assert.rejects(verifyProduction('http://example.org'),/HTTPS/)
console.log('PASS launch artifacts: stable PWA identity/icons, update-router regression, root recovery boundary, Render SPA/cache headers, readiness scanner rejects HTML masquerading as required assets. Not a live device test.')
