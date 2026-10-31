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

// The public catalogue and its protected save RPC shipped in 013. They do not
// depend on 023's generic admin_list wrapper or the financial rollout.
export async function loadSocialPlatformDirectory(client,search='',page=0){
 const result=await withTimeout(client.from('social_platforms').select('key,label,hosts',{count:'exact'})
  .ilike('label','%'+String(search).slice(0,200)+'%').order('key').range(page*25,page*25+24))
 if(result.error)throw result.error
 if(!Array.isArray(result.data)||!Number.isInteger(result.count)||result.count<0)throw new Error('Invalid platform catalogue response')
 return {rows:result.data,total:result.count}
}
