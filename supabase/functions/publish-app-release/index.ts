import {createClient} from 'jsr:@supabase/supabase-js@2'
import {productionMarker,productionHtml} from '../_shared/push-utils.ts'
Deno.serve(async(req:Request)=>{
 const origin=Deno.env.get('PRODUCTION_ORIGIN')||''
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers})
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply(403,{error:'Origin denied'})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return reply(405,{error:'POST required'})
 try{
  const target=new URL(origin);if(target.protocol!=='https:'||target.origin!==origin||target.username||target.password)throw new Error('origin')
  const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('authorization')||''}},auth:{persistSession:false}})
  const {data:{user},error}=await userClient.auth.getUser();if(error||!user)return reply(401,{error:'Sign in required'})
  const access=await userClient.rpc('mission_staff_access');if(access.error||access.data!==true)return reply(403,{error:'Authorized verified administrator required'})
  const data=await req.json();if(typeof data.version!=='string'||data.version.length<1||data.version.length>60||typeof data.notes!=='string'||data.notes.trim().length<8||data.notes.length>3000||data.authorized!==true||typeof data.reason!=='string'||data.reason.trim().length<8||data.reason.length>1000)return reply(400,{error:'Release notes and explicit authorization required'})
  // Never fetch a user-supplied URL. Public production marker + healthy app must match this exact release.
  const [marker,home]=await Promise.all([fetch(origin+'/version.json?confirm='+Date.now(),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)}),fetch(origin+'/',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)})])
  if(!marker.ok||!home.ok||!home.headers.get('content-type')?.includes('text/html'))return reply(409,{error:'Production release is not available'})
  const version=await marker.json();if(version.version!==data.version||!productionMarker(version,data.commit)||!productionHtml(await home.text(),data.commit))return reply(409,{error:'Expected version is not published in production'})
  const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
  const result=await service.rpc('confirm_production_release',{p_actor:user.id,p_commit:data.commit,p_version:data.version,p_notes:data.notes.trim(),p_built:version.builtAt,p_reason:data.reason.trim()})
  if(result.error)throw new Error('release reconciliation');return reply(200,{announcement:result.data})
 }catch{return reply(503,{error:'Release confirmation unavailable. No unverified release was announced.'})}
})
