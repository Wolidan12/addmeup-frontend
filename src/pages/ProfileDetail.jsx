import RelationshipActions from '../components/RelationshipActions'
import {profileCompletion} from '../lib/accountValidation'
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
   try{const {data,error}=await withTimeout(supabase.rpc('discovery_profile',{p_username:username,p_managed:managed}))
   if(!active)return
   if(error||!data){setErr('Profile not found or unavailable.');return}
   const campaign=new URLSearchParams(window.location.search).get('promotion');const placement=data.paid_placements?.find(c=>c.promotion_id===campaign);setP(managed?{...data,managed:true}:{...data,...placement});
   if(campaign&&data&&user&&!managed)withTimeout(supabase.rpc('record_promotion_event',{p_campaign:campaign,p_profile:data.id,p_kind:'profile_open',p_platform:''})).catch(()=>{});
   if(data&&user&&!managed)withTimeout(supabase.rpc('record_profile_view',{p_profile:data.id})).catch(()=>{})
   }catch{if(active)setErr('This profile could not be loaded. Please try again.');}
  })()
  return()=>{active=false}
 },[username,managed,user])
 if(blocked)return <main className="max-w-xl mx-auto p-10"><p>You blocked this user. Their content is hidden from you.</p></main>
 return <main className="profile-detail-v2"><div className="profile-dossier-label">DANQEL / CREATOR DOSSIER <span>CONNECT. ENGAGE. GROW.</span></div><Link className="profile-detail-back" to="/discover"><ArrowLeft size={15}/>Back to discovery</Link><States loading={!p&&!err} error={err} empty={false}/>{p&&<div className="profile-detail-grid"><ProfileCard p={p}/><aside className="profile-detail-info"><ShieldCheck size={28}/><h1>Make the connection.<br/>Keep it genuine.</h1><p>{managed?'This is a managed listing, published by the team with permission. It is not a separate login account.':'Explore this creator’s public profile and connect through their listed social platforms.'}</p><p className="mt-4">Social links open the official platform. We never ask for your social media passwords.</p><Link className="design-button secondary" to="/support">{managed?'Ask about this listing':'Get help or report a concern'}</Link><RelationshipActions profile={p} onBlocked={()=>setBlocked(true)}/><Link to={managed?'/support':user?'/discover?report='+encodeURIComponent(p.username):'/login'}>Report suspicious profile →</Link>{!managed&&<div className="profile-account-facts"><div><span>Creator XP</span><strong>{Number(p.creator_xp||0).toLocaleString()}</strong></div><div><span>Creator level</span><strong>{p.creator_level||1}</strong></div><div><span>Public profile completion</span><strong>{profileCompletion(p,p.social_links?.filter(l=>l.is_public).length||0)}%</strong></div><p>Member since {p.created_at?new Date(p.created_at).toLocaleDateString():'—'}</p>{p.location&&<p>{p.location}</p>}{p.categories?.length>0&&<p>Categories: {p.categories.join(', ')}</p>}<p>Creator XP is independently earned through missions, not purchased. Public completion uses visible links only; a member’s private completion can differ.</p></div>}<small>Only information this creator chose to share publicly is shown here.</small></aside></div>}</main>
}
