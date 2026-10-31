import {withTimeout} from '../lib/errors.js'

// Missing schema is a rollout condition, not an empty dataset or permission grant.
export function backendUpgradeRequired(error) {
 return ['PGRST202','PGRST205','42883','42P01'].includes(error?.code)
   || (error?.code==='P0001' && error?.message==='Unsupported resource')
}
export async function loadWorkspaceMetrics(client,days) {
 const result=await withTimeout(client.rpc('admin_metrics',{p_days:days}))
 if(!result.error){
  if(!result.data||!Array.isArray(result.data.registration_series))throw new Error('Invalid metrics response')
  return {mode:'current',data:result.data}
 }
 // Only the absent metrics RPC justifies a compatibility query. Never retry a
 // denied, timed-out, or broken current report through a different endpoint.
 if(!['PGRST202','42883'].includes(result.error.code))throw result.error
 const fallback=await withTimeout(client.rpc('admin_overview'))
 if(fallback.error)throw fallback.error
 if(!fallback.data||!Array.isArray(fallback.data.trend)||!Number.isFinite(fallback.data.profiles))throw new Error('Invalid overview response')
 return {mode:'legacy',data:fallback.data}
}
