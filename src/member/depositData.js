import {withTimeout} from '../lib/errors.js'
import {missingBackend} from '../lib/backendAvailability.js'

// Funding configuration must not hide existing owner-scoped order history.
// Missing financial rollout dependencies never enable old payment mutations.
export async function loadDepositScreen(client,userId,page=0){
 const read=async query=>{try{return await withTimeout(query)}catch(error){return {error}}}
 const [packages,orders,settings]=await Promise.all([
  read(client.from('point_packages').select('*').eq('is_active',true).order('price_kobo').limit(100)),
  read(client.from('bank_point_orders').select('*',{count:'exact'}).eq('user_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*10,page*10+9)),
  read(client.from('dc_settings').select('deposits_enabled').single())
 ])
 const historyError=orders.error||(!Array.isArray(orders.data)||!Number.isSafeInteger(orders.count)||orders.count<0||orders.data.some(row=>row.user_id!==userId)?new Error('Invalid order history'):null)
 const settingsError=settings.error||(typeof settings.data?.deposits_enabled!=='boolean'?new Error('Invalid funding configuration'):null)
 return {orders:historyError?[]:orders.data,total:historyError?null:orders.count,historyError,
  packages:packages.error||!Array.isArray(packages.data)?[]:packages.data,
  enabled:settingsError||historyError?null:settings.data.deposits_enabled,
  unavailable:!!settingsError,upgrade:!!settingsError&&missingBackend(settingsError)}
}
