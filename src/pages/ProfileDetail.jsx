import {ArrowLeft,ShieldCheck} from 'lucide-react'
import {withTimeout} from '../lib/errors'
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
   try{const {data,error}=await withTimeout(supabase.from(managed?'managed_profiles':'profiles').select(managed?'*':'*,social_links(platform,url,is_public)').eq('username',username).single())
   if(!active)return
   if(error){setErr('Profile not found.');return}
   setP(managed?{...data,managed:true}:data)
   if(data&&user&&!managed)withTimeout(supabase.rpc('record_profile_view',{p_profile:data.id})).catch(()=>{})
   }catch{if(active)setErr('This profile could not be loaded. Please try again.');}
  })()
  return()=>{active=false}
 },[username,managed,user])
 if(blocked)return <main className="max-w-xl mx-auto p-10"><p>You blocked this user. Their content is hidden from you.</p></main>
 return <main className="profile-detail-v2"><Link className="profile-detail-back" to="/discover"><ArrowLeft size={15}/>Back to discovery</Link><States loading={!p&&!err} error={err} empty={false}/>{p&&<div className="profile-detail-grid"><ProfileCard p={p}/><aside className="profile-detail-info"><ShieldCheck size={28}/><h1>Make the connection.<br/>Keep it genuine.</h1><p>{managed?'This is a managed listing, published by the team with permission. It is not a separate login account.':'Explore this creator’s public profile and connect through their listed social platforms.'}</p><p className="mt-4">Social links open the official platform. We never ask for your social media passwords.</p><Link className="design-button secondary" to="/support">{managed?'Ask about this listing':'Get help or report a concern'}</Link>{user&&!managed&&user.id!==p.id&&<button className="design-button secondary mt-4" onClick={async()=>{if(!window.confirm('Block this profile? Their content will be hidden from you.'))return;try{const {error}=await withTimeout(supabase.from('blocks').insert({blocker_id:user.id,blocked_id:p.id}));if(error)throw error;setBlocked(true)}catch{setErr('We could not block this profile. Please try again.')}}}>Block this profile</button>}<small>Only information this creator chose to share publicly is shown here.</small></aside></div>}</main>
}
