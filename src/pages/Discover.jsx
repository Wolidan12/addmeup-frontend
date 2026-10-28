import {withTimeout} from '../lib/errors'
import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {Search,SlidersHorizontal,ArrowUpRight} from 'lucide-react'
import {ProfileCard} from '../components/ui'
import PlatformLogo,{PLATFORM_LABELS} from '../components/PlatformLogo'
import {supabase,isSupabaseConfigured} from '../lib/supabase'
import {useAuth} from '../context/AuthContext'
import {useSite} from '../context/SiteContext'
export default function Discover(){
 const {user}=useAuth(),site=useSite(),[q,setQ]=useState(''),[search,setSearch]=useState(''),[platform,setPlatform]=useState(''),[country,setCountry]=useState(''),[interest,setInterest]=useState(''),[page,setPage]=useState(0),[rows,setRows]=useState([]),[total,setTotal]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[saved,setSaved]=useState(new Set()),[saving,setSaving]=useState(null),[report,setReport]=useState(null),[reportError,setReportError]=useState(''),[sending,setSending]=useState(false),[version,setVersion]=useState(0),dialog=useRef(null)
 useEffect(()=>{const timer=setTimeout(()=>{setSearch(q);setPage(0)},300);return()=>clearTimeout(timer)},[q])
 useEffect(()=>{let active=true;setBusy(true);setError('')
  if(!isSupabaseConfigured){setBusy(false);setError('Creator profiles are temporarily unavailable. Please try again later.');return}
  ;(async()=>{
   try{const {data,error}=await withTimeout(supabase.rpc('public_directory',{p_search:search,p_platform:platform,p_country:country,p_interest:interest,p_page:page}))
   if(!active)return
   if(error){setError('We couldn’t load creators. Please try again.');setRows([]);setBusy(false);return}
   setRows(data.rows);setTotal(data.total)
   if(user){const {data:f,error:fe}=await supabase.from('favourites').select('profile_id').eq('user_id',user.id).in('profile_id',data.rows.filter(p=>!p.managed).map(p=>p.id));if(active&&!fe)setSaved(new Set((f||[]).map(x=>x.profile_id)))}
   if(active)setBusy(false)
   }catch{if(active){setError('We couldn’t load creators. Please try again.');setRows([]);setBusy(false)}}
  })()
  return()=>{active=false}
 },[search,platform,country,interest,page,user,version])
 useEffect(()=>{if(report)dialog.current?.showModal()},[report])
 async function save(p){setSaving(p.id);setMessage('');try{
  const result=saved.has(p.id)?await supabase.from('favourites').delete().eq('user_id',user.id).eq('profile_id',p.id):await supabase.from('favourites').insert({user_id:user.id,profile_id:p.id})
  if(result.error)throw result.error
  setSaved(old=>{const next=new Set(old);next.has(p.id)?next.delete(p.id):next.add(p.id);return next});setMessage(saved.has(p.id)?'Profile removed from saved profiles.':'Profile saved.')
 }catch{setMessage('Could not update saved profile. Please retry.')}finally{setSaving(null)}}
 async function sendReport(e){e.preventDefault();setSending(true);setReportError('');try{const {error}=await supabase.from('reports').insert({reporter_id:user.id,profile_id:report.id,reason:new FormData(e.target).get('reason')});if(error)throw error;setReport(null);setMessage('Your report has been sent to moderation.')}catch{setReportError('Could not send your report. Please retry.')}finally{setSending(false)}}
 return <main className="directory-page"><div className="member-page-heading"><div><p className="member-eyebrow">FIND YOUR NEXT GOOD CONNECTION</p><h1>Explore the community.</h1><p>Discover people who share your interests. Connect on your own terms.</p></div>{user&&<Link to="/settings" className="member-primary">My listing <ArrowUpRight size={15}/></Link>}</div>
 <div className="directory-platforms"><button aria-pressed={!platform} className={!platform?'selected':''} onClick={()=>{setPlatform('');setPage(0)}}>All platforms</button>{site.enabled_platforms.map(p=><button key={p} className={platform===p?'selected':''} aria-pressed={platform===p} onClick={()=>{setPlatform(p);setPage(0)}}><PlatformLogo platform={p} size={23}/>{PLATFORM_LABELS[p]}</button>)}</div>
 <form className="directory-search" role="search" onSubmit={e=>{e.preventDefault();setVersion(v=>v+1)}}><label><Search size={17}/><input aria-label="Search creators" placeholder="Search names, interests or bios…" value={q} onChange={e=>setQ(e.target.value)}/></label><label><SlidersHorizontal size={15}/><input aria-label="Country filter" placeholder="Country" value={country} onChange={e=>{setCountry(e.target.value);setPage(0)}}/></label><input aria-label="Interest filter" placeholder="Interest" value={interest} onChange={e=>{setInterest(e.target.value);setPage(0)}}/></form>
 {error&&<p className="member-error" role="alert">{error} <button onClick={()=>setVersion(v=>v+1)}>Retry</button></p>}{message&&<p className="member-notice" role="status">{message}</p>}<div className="directory-results"><span>{busy?'Finding connections…':`${total.toLocaleString()} creator${total===1?'':'s'}`}</span><span>12 per page</span></div>
 {busy?<p className="member-empty" role="status">Loading creators…</p>:!rows.length&&!error?<div className="member-panel member-empty"><Search size={27}/><h2>No creators found</h2><p>Try another search, or publish your own profile to join the community.</p>{user&&<Link to="/settings">Complete my profile →</Link>}</div>:<div className="directory-grid">{rows.map(p=><div key={`${p.managed?'listing':'user'}-${p.id}`}><ProfileCard p={p} saved={saved.has(p.id)} onSave={user&&!p.managed&&saving!==p.id?save:null}/><div className="directory-card-actions">{p.managed?<Link to="/support">Report listing</Link>:user?<button onClick={()=>{setReportError('');setReport(p)}}>Report profile</button>:<Link to="/login">Sign in to save or report</Link>}{saving===p.id&&<span role="status">Saving…</span>}</div></div>)}</div>}
 <div className="member-pagination"><span>Page {page+1} of {Math.max(1,Math.ceil(total/12))}</span><div><button className="btn2" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="btn2" disabled={busy||(page+1)*12>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
 {report&&<dialog ref={dialog} className="member-dialog" aria-labelledby="report-title" onCancel={e=>{if(sending)e.preventDefault();else setReport(null)}}><form onSubmit={sendReport}><h2 id="report-title">Report @{report.username}</h2><p>Tell our moderation team what happened. Your report isn’t displayed publicly.</p><label className="text-sm">Reason<textarea className="mt-2" name="reason" required minLength={8} maxLength={500} rows={4}/></label>{reportError&&<p role="alert" className="member-error">{reportError}</p>}<div className="member-dialog-actions"><button type="button" disabled={sending} onClick={()=>setReport(null)}>Cancel</button><button className="member-primary" disabled={sending}>{sending?'Sending…':'Submit report'}</button></div></form></dialog>}
 </main>
}
