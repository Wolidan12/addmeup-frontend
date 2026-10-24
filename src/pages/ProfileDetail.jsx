import {useEffect,useState} from 'react'
import {useParams,Link} from 'react-router-dom'
import {ProfileCard,States} from '../components/ui'
import {supabase,isSupabaseConfigured} from '../lib/supabase'
import {useAuth} from '../context/AuthContext'
export default function ProfileDetail({managed=false}){
 const {username}=useParams(),{user}=useAuth(),[p,setP]=useState(null),[err,setErr]=useState(''),[blocked,setBlocked]=useState(false)
 useEffect(()=>{let active=true;setP(null);setErr('');setBlocked(false)
  ;(async()=>{
   if(!isSupabaseConfigured){if(active)setErr('Profiles are temporarily unavailable. Please try again later.');return}
   const {data,error}=await supabase.from(managed?'managed_profiles':'profiles').select(managed?'*':'*,social_links(platform,url,is_public)').eq('username',username).single()
   if(!active)return
   if(error){setErr('Profile not found.');return}
   setP(managed?{...data,managed:true}:data)
   if(data&&user&&!managed)supabase.rpc('record_profile_view',{p_profile:data.id})
  })()
  return()=>{active=false}
 },[username,managed,user])
 if(blocked)return <main className="max-w-xl mx-auto p-10"><p>You blocked this user. Their content is hidden from you.</p></main>
 return <main className="max-w-2xl mx-auto px-4 py-10"><Link to="/discover">← Back to Discover</Link><div className="mt-4"><States loading={!p&&!err} error={err} empty={false}/>{p&&<><ProfileCard p={p}/>{user&&!managed&&<div className="flex gap-3 mt-4"><button className="btn2" onClick={async()=>{if(isSupabaseConfigured){const {error}=await supabase.from('blocks').insert({blocker_id:user.id,blocked_id:p.id});if(error){setErr(error.message);return}}setBlocked(true)}}>Block user</button></div>}{managed?<p className="text-xs text-violet-300 mt-4">Admin-managed listing, published with permission. <Link to="/support">Contact support about this listing.</Link></p>:<p className="text-xs text-violet-300 mt-4">Links open official social apps. Danqel never asks for your social media passwords.</p>}</>}</div></main>
}
