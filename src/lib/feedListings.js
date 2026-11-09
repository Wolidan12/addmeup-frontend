import {InputError} from './errors.js'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const listingRequestKey=user=>'danqel_feed_request_'+user
export function listingRequestValid(value,user){return !!value&&value.userId===user&&uuid.test(value.id)&&typeof value.packageKey==='string'&&value.packageKey.length<=40&&Number.isSafeInteger(value.cost)&&value.cost>0&&Number.isSafeInteger(value.hours)&&value.hours>=7&&value.hours<=720}
export function readListingRequest(user,storage=localStorage){
 const saved=storage.getItem(listingRequestKey(user));if(!saved)return null
 let parsed;try{parsed=JSON.parse(saved)}catch{throw new InputError('The saved listing request could not be read. Contact support before buying again.')}
 if(!listingRequestValid(parsed,user))throw new InputError('The saved listing request needs review. Contact support before buying again.')
 return parsed
}
export function persistListingRequest(value,user,storage=localStorage){if(!listingRequestValid(value,user))throw new InputError('The listing request could not be saved. Refresh and retry.');storage.setItem(listingRequestKey(user),JSON.stringify(value))}
export function listingPayload(pkg,request){
 if(!pkg||!uuid.test(request)||typeof pkg.key!=='string'||!Number.isSafeInteger(pkg.cost_dc)||pkg.cost_dc<=0||!Number.isInteger(pkg.duration_hours)||pkg.duration_hours<7||pkg.duration_hours>720)throw new InputError('This listing package needs to be refreshed.')
 return {p_package:pkg.key,p_request:request,p_expected_cost:pkg.cost_dc,p_expected_hours:pkg.duration_hours}
}
export function validateFeedState(value,user){
 if(!value||!Number.isSafeInteger(value.purchased_dc)||value.purchased_dc<0||!Number.isSafeInteger(value.total_dc)||value.purchased_dc>Math.max(0,value.total_dc)||!Array.isArray(value.packages)||!Array.isArray(value.rows)||!Number.isSafeInteger(value.total)||value.total<0||!Number.isFinite(Date.parse(value.server_now))||typeof value.enabled!=='boolean'||typeof value.profile_ready!=='boolean'||typeof value.in_feed!=='boolean'||(value.active_until!==null&&!Number.isFinite(Date.parse(value.active_until))))throw new Error('Unavailable feed listing state')
 value.packages.forEach(p=>listingPayload(p,'00000000-0000-4000-8000-000000000001'))
 if(value.rows.some(r=>r.user_id!==user||!uuid.test(r.id)||!Number.isFinite(Date.parse(r.starts_at))||!Number.isFinite(Date.parse(r.ends_at))||!['active','queued','expired'].includes(r.status)))throw new Error('Invalid listing history')
 return value
}
