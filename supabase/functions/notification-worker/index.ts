import {createClient} from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {equalSecret,pushOutcome,retrySeconds,validEndpoint} from '../_shared/push-utils.ts'
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('POST required',{status:405})
 const secret=Deno.env.get('PUSH_CRON_SECRET')||''
 if(!equalSecret(req.headers.get('authorization')||'','Bearer '+secret)||secret.length<32)return new Response('Unauthorized',{status:401})
 try{
  const pub=Deno.env.get('VAPID_PUBLIC_KEY'),priv=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT')
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
  const tick=await db.rpc('notification_tick');if(tick.error)throw new Error('scheduler')
  if(!pub||!priv||!subject)return Response.json({inbox_processed:tick.data,push_configured:false})
  webpush.setVapidDetails(subject,pub,priv)
  const {data:jobs,error}=await db.rpc('push_claim',{p_limit:20});if(error)throw new Error('queue')
  let acknowledged=0
  // Bounded concurrency and network timeout keep this inside the lease and Edge execution budget.
  const pending=[...(jobs||[])];await Promise.all(Array.from({length:4},async()=>{while(pending.length){const job=pending.shift();let status=0,retry=0
   if(!validEndpoint(job.endpoint))status=400
   else try{const result=await webpush.sendNotification({endpoint:job.endpoint,keys:job.keys},JSON.stringify(job.payload),{TTL:3600,urgency:'normal',timeout:10000});status=result.statusCode}catch(e){const err=e as {statusCode?:number,headers?:Record<string,string>};status=Number(err.statusCode)||0;retry=retrySeconds(err.headers?.['retry-after']||null)}
   const ack=await db.rpc('push_finish',{p_id:job.id,p_token:job.token,p_outcome:pushOutcome(status),p_http_status:status||null,p_retry_after:retry});if(!ack.error&&ack.data)acknowledged++
  }}))
  return Response.json({claimed:jobs?.length||0,acknowledged})
 }catch{return new Response('Notification processing unavailable',{status:503})}
})
