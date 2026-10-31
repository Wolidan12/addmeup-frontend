// Real locally built service worker + Chromium; no real Auth, deposit or push delivery.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>!['--single-process','--disable-web-security'].includes(a)),headless:true})
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),page=await context.newPage();page.setDefaultTimeout(30000)
 await context.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({contentType:'application/json',body:'[]'}))
 const client=await context.newCDPSession(page);await client.send('Network.enable');await client.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:200000,uploadThroughput:90000});const start=Date.now();await page.goto('http://localhost:5175/register',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('input[type=email]').waitFor();console.log('Local production build registration form: '+(Date.now()-start)+'ms on simulated 400ms latency / 1.6Mbps download; no real-device/Core Web Vitals certification.')
 await client.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller)
 const cache=await page.evaluate(async()=>{const rows=[];for(const name of await caches.keys())for(const r of await(await caches.open(name)).keys())rows.push(r.url);return rows});assert.ok(!cache.some(u=>u.includes('.supabase.co/')));assert.ok(cache.some(u=>u.includes('/offline.html')))
 await context.setOffline(true);await page.goto('http://localhost:5175/never-visited-offline-'+Date.now(),{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:"You're offline"}).waitFor();assert.equal(await page.getByRole('link',{name:'Try again'}).count(),1)
 await context.setOffline(false);await page.goto('http://localhost:5175/install');await page.getByRole('heading',{name:'Keep your community close.'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
 console.log('PASS real local production service worker registration/control, precached offline fallback on a new URL, online recovery, no Supabase API cache and mobile install-guide layout. Not a production-domain or installed-device test.')
}finally{await browser.close()}
