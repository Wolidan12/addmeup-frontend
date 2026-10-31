import {withTimeout} from '../lib/errors.js'
export function validateMemberOverview(data,userId){
 if(!data||data.profile?.id!==userId||!data.balance||data.balance.balance==null||!Number.isFinite(Number(data.balance.balance))||!Array.isArray(data.recent_activity))throw new Error('Incomplete member response')
 if(data.balance.user_id&&data.balance.user_id!==userId)throw new Error('Mismatched wallet owner')
 return data
}
export async function loadMemberWallet(client,userId,{kind='transactions',status='',page=0}={}){
 const current=await withTimeout(client.rpc('dc_wallet',{p_kind:kind,p_status:status,p_page:page}))
 if(!current.error){if(!current.data||!Array.isArray(current.data.rows)||current.data.balance==null||!Number.isFinite(Number(current.data.balance)))throw new Error('Invalid wallet response');return {mode:'current',data:current.data}}
 if(!['PGRST202','42883'].includes(current.error.code))throw current.error
 // Existing owner-filtered RLS tables, SELECT only. Do not fall back to any
 // old payment/reward mutation, and never synthesize a balance or snapshots.
 const table=kind==='deposits'?'bank_point_orders':'points_ledger'
 let history=client.from(table).select('*',{count:'exact'}).eq('user_id',userId)
 if(status&&kind==='deposits')history=history.eq('status',status)
 const [balance,records]=await withTimeout(Promise.all([
  client.from('points_balance').select('balance').eq('user_id',userId).maybeSingle(),
  history.order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+19)
 ]))
 if(balance.error||records.error)throw balance.error||records.error
 if(!Array.isArray(records.data)||!Number.isInteger(records.count))throw new Error('Invalid history response')
 const value=balance.data?.balance
 if(value!=null&&!Number.isFinite(Number(value)))throw new Error('Invalid balance')
 return {mode:'legacy',data:{balance:value??null,rows:records.data,total:records.count,kind}}
}
