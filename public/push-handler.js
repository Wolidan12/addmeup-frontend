/* Extends the existing Workbox worker; never intercepts Auth or API traffic. */
const DANQEL_DESTINATIONS=['/notifications','/missions','/wallet','/discover','/connections','/boosts','/settings','/release-notes'];
function danqelDestination(value){try{const u=new URL(value,self.location.origin);return u.origin===self.location.origin&&DANQEL_DESTINATIONS.includes(u.pathname)?u.href:self.location.origin+'/notifications'}catch{return self.location.origin+'/notifications'}}
async function danqelSeen(id){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('danqel-push-seen',1);r.onupgradeneeded=()=>r.result.createObjectStore('messages',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('messages','readwrite'),store=tx.objectStore('messages');let seen=false;const get=store.get(id);get.onsuccess=()=>{seen=!!get.result;store.put({id,time:Date.now()});const cursor=store.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){if(c.value.time<Date.now()-7*86400000)c.delete();c.continue()}}};tx.oncomplete=()=>resolve(seen);tx.onerror=()=>reject(tx.error)})}finally{db.close()}
}
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let data={};try{data=event.data?.json()||{}}catch{}
 const id=typeof data.id==='string'&&/^[a-f0-9-]{36}$/.test(data.id)?data.id:'danqel-notification';
 try{if(await danqelSeen(id))return}catch{/* Storage unavailable: tag still collapses visible duplicates. */}
 await self.registration.showNotification(typeof data.title==='string'?data.title.slice(0,100):'Danqel update',{body:typeof data.body==='string'?data.body.slice(0,250):'Open your inbox for the latest updates.',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:id,renotify:false,data:{url:danqelDestination(data.url)},actions:[{action:'open',title:'Open Danqel'}]});
})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const url=danqelDestination(event.notification.data?.url),clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=clients.find(c=>new URL(c.url).origin===self.location.origin);if(existing){await existing.navigate(url);return existing.focus()}return self.clients.openWindow(url)})())});
self.addEventListener('message',event=>{if(event.data?.type==='CLEAR_DANQEL_NOTIFICATIONS')event.waitUntil(self.registration.getNotifications().then(items=>items.forEach(n=>n.close())))});
// Do not silently re-subscribe on pushsubscriptionchange: consent/key rotation is reconciled in the preferences page.
