import {supabase} from './supabase'
import {InputError,withTimeout} from './errors'
export const NOTIFICATION_CATEGORIES={daily:'Daily reminders',missions:'Missions',rewards:'Rewards & bonuses',connections:'New connections',boosts:'Profile/reward boosts',promotions:'Promotion decisions',deposits:'Deposits & refunds',account:'Account updates',features:'New features',app_updates:'Application releases',events:'Events & campaigns',security:'Security alerts'}
export function pushSupport(){const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;return{ios,needsInstall:ios&&!standalone,supported:window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window,permission:'Notification' in window?Notification.permission:'unsupported'}}
export function vapidBytes(value){const base=value.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(base+'='.repeat((4-base.length%4)%4)),c=>c.charCodeAt(0))}
export async function enableDevicePush(userId,publicKey){
 const support=pushSupport();if(!support.supported||support.needsInstall)throw new InputError('Install the app on a supported device before enabling push.')
 if(!publicKey)throw new InputError('Device notifications are not configured yet. Your in-app inbox still works.')
 if(Notification.permission==='denied')throw new InputError('Notifications are blocked in browser settings. Permission will not be requested again automatically.')
 // This function is invoked only by the explicit Enable device button.
 const permission=await Notification.requestPermission();if(permission!=='granted')throw new InputError('Device notifications were not enabled. You can keep using your inbox.')
 const reg=await withTimeout(navigator.serviceWorker.ready,15000);let sub=await reg.pushManager.getSubscription()
 if(sub?.options?.applicationServerKey){const expected=vapidBytes(publicKey),current=new Uint8Array(sub.options.applicationServerKey);if(expected.length!==current.length||expected.some((v,i)=>v!==current[i])){await sub.unsubscribe();sub=null}}
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(publicKey)})
 try{const data=sub.toJSON();const result=await withTimeout(supabase.rpc('push_subscribe',{p_endpoint:data.endpoint,p_p256dh:data.keys.p256dh,p_auth:data.keys.auth,p_device:(navigator.userAgentData?.platform||navigator.platform||'Browser').slice(0,80)}));if(result.error)throw result.error;localStorage.setItem('danqel-push-device:'+userId,result.data);return result.data}catch(e){await sub.unsubscribe().catch(()=>{});throw e}
}
export async function disableDevicePush(userId){
 const id=localStorage.getItem('danqel-push-device:'+userId)
 if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager.getSubscription();if(sub)await sub.unsubscribe();reg?.active?.postMessage({type:'CLEAR_DANQEL_NOTIFICATIONS'})}
 if(id){const {error}=await withTimeout(supabase.rpc('push_unsubscribe',{p_id:id}));if(error)throw error;localStorage.removeItem('danqel-push-device:'+userId)}
}
