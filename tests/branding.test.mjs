import assert from 'node:assert/strict'
import {readFile,stat} from 'node:fs/promises'
for(const [file,size] of [['icon-32.png',32],['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512],['apple-touch-icon.png',180]]){
 const bytes=await readFile('public/icons/'+file)
 assert.equal(bytes.subarray(1,4).toString(),'PNG')
 assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size)
}
for(const name of ['danqel-logo','danqel-mark','danqel-wordmark']){
 const b=await readFile('public/brand/'+name+'.webp');assert.equal(b.subarray(8,12).toString(),'WEBP');assert.ok((await stat('public/brand/'+name+'.webp')).size<500000)
}
for(const f of ['src/components/chrome.jsx','src/member/MemberLayout.jsx','src/pages/AuthPages.jsx','src/pages/Admin.jsx']){
 const code=await readFile(f,'utf8');assert.ok(code.includes('<BrandLogo'));assert.ok(!code.includes('>d.</span>'))
}
const html=await readFile('index.html','utf8');assert.ok(html.includes('/icons/icon-32.png'));assert.ok(html.includes('/icons/apple-touch-icon.png'));assert.ok(!html.includes('icon-192.svg'))
const config=await readFile('vite.config.js','utf8');assert.ok(config.includes('/icons/icon-maskable-512.png'));assert.ok(config.includes('purpose: "maskable"'));assert.ok(config.includes('"brand/*.webp"'))
assert.ok((await readFile('public/offline.html','utf8')).includes('/brand/danqel-logo.webp'))
console.log('Approved brand artwork, shared shell integration, favicon/touch dimensions and distinct maskable PWA icon passed')
