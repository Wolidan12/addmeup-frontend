import {useFeedRefresh} from '../lib/useFeedRefresh'
import RelationshipActions from '../components/RelationshipActions'
import {ExperienceBanner} from '../components/Experience'
import WorkspaceNav from '../components/WorkspaceNav'
import {withTimeout} from '../lib/errors'
import {useEffect,useRef,useState} from 'react'
import {Link,useSearchParams} from 'react-router-dom'
import {Search,SlidersHorizontal,ArrowUpRight} from 'lucide-react'
import {SimpleProfileCard} from '../components/ui'
import './discover.css'
import PlatformLogo,{PLATFORM_LABELS} from '../components/PlatformLogo'
import {supabase,isSupabaseConfigured} from '../lib/supabase'
import {useAuth} from '../context/AuthContext'
import {useSite} from '../context/SiteContext'

export default function Discover(){
 const {tick,track,visible}=useFeedRefresh()
 const [params]=useSearchParams(),handledReport=useRef(null)
 const {user}=useAuth(),site=useSite(),[q,setQ]=useState(params.get('report')||params.get('profile')||params.get('managed')||''),[search,setSearch]=useState(''),[platform,setPlatform]=useState(''),[country,setCountry]=useState(''),[interest,setInterest]=useState(''),[page,setPage]=useState(0),[rows,setRows]=useState([]),[paid,setPaid]=useState([]),[total,setTotal]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[saved,setSaved]=useState(new Set()),[report,setReport]=useState(null),[reportError,setReportError]=useState(''),[sending,setSending]=useState(false),[version,setVersion]=useState(0),dialog=useRef(null)

 useEffect(()=>{const timer=setTimeout(()=>{setSearch(q);setPage(0)},300);return()=>clearTimeout(timer)},[q])
 useEffect(()=>{let active=true;setBusy(true);setError('')
  if(!isSupabaseConfigured){setBusy(false);setError('Creator profiles are temporarily unavailable. Please try again later.');return}
  ;(async()=>{
   try{const {data,error}=await withTimeout(supabase.rpc('public_directory',{p_search:search,p_platform:platform,p_country:country,p_interest:interest,p_page:page}))
   if(!active)return
   if(error){setError('We couldn’t load creators. Please try again.');setRows([]);setPaid([]);setBusy(false);return}
   track(data);setRows(data.rows);setPaid(data.paid_rows||[]);setTotal(data.total);if(user&&params.get('report')&&handledReport.current!==params.get('report')){const target=data.rows.find(p=>!p.managed&&p.username===params.get('report'));if(target){handledReport.current=target.username;setReport(target)}}
   if(user){const {data:f,error:fe}=await supabase.from('favourites').select('profile_id').eq('user_id',user.id).in('profile_id',[...data.rows,...(data.paid_rows||[])].filter(p=>!p.managed).map(p=>p.id));if(active&&!fe)setSaved(new Set((f||[]).map(x=>x.profile_id)))}
   if(active)setBusy(false)
   }catch{if(active){setError('We couldn’t load creators. Please try again.');setRows([]);setPaid([]);setBusy(false)}}
  })()
  return()=>{active=false}
 },[search,platform,country,interest,page,user,version,tick,track])
 useEffect(()=>{if(report)dialog.current?.showModal()},[report])
 async function sendReport(e){e.preventDefault();setSending(true);setReportError('');try{const {error}=await supabase.from('reports').insert({reporter_id:user.id,profile_id:report.id,reason:new FormData(e.target).get('reason')});if(error)throw error;setReport(null);setMessage('Your report has been sent to moderation.')}catch{setReportError('Could not send your report. Please retry.')}finally{setSending(false)}}
 const renderCard=(p,key)=><div key={key}><SimpleProfileCard p={p} actions={<RelationshipActions profile={{...p,is_saved:saved.has(p.id)}} compact onMessage={setMessage} onChanged={()=>setVersion(v=>v+1)}/>}/><div className="directory-card-actions">{p.managed?<Link to="/support">Report listing</Link>:user?<button onClick={()=>{setReportError('');setReport(p)}}>Report profile</button>:<Link to="/login">Sign in to save or report</Link>}</div></div>

 return <main className={`directory-page discover-simple${user?' discover-simple-member':''}`}><WorkspaceNav community/>
  <div className="member-page-heading"><div><p className="member-eyebrow">FIND YOUR NEXT GOOD CONNECTION</p><h1>Explore the community.</h1><p>Discover people who share your interests. Connect on your own terms.</p></div>{user&&<Link to="/list-profile" className="member-primary">My listing <ArrowUpRight size={15}/></Link>}</div>
  {user&&<div className="directory-mobile-listing"><span>List your profile</span><Link to="/list-profile">Get listed</Link></div>}
  <ExperienceBanner title="Find your frequency." description="Different platforms. Shared interests. Your next genuine connection."/>
  <div className="directory-platforms"><button aria-pressed={!platform} className={!platform?'selected':''} onClick={()=>{setPlatform('');setPage(0)}}>All platforms</button>{site.enabled_platforms.map(p=><button key={p} className={platform===p?'selected':''} aria-pressed={platform===p} onClick={()=>{setPlatform(p);setPage(0)}}><PlatformLogo platform={p} size={23}/>{site.platforms?.find(x=>x.key===p)?.label||PLATFORM_LABELS[p]||p}</button>)}</div>
  <form className="directory-search" role="search" onSubmit={e=>{e.preventDefault();setVersion(v=>v+1)}}>
   <label><Search size={17}/><input aria-label="Search creators" placeholder="Search username or display name…" value={q} onChange={e=>setQ(e.target.value)}/></label>
   <label><SlidersHorizontal size={15}/><input aria-label="Country filter" placeholder="Country" value={country} onChange={e=>{setCountry(e.target.value);setPage(0)}}/></label>
   <input aria-label="Interest filter" placeholder="Interest" value={interest} onChange={e=>{setInterest(e.target.value);setPage(0)}}/>
   <select className="directory-mobile-platform" aria-label="Platform filter" value={platform} onChange={e=>{setPlatform(e.target.value);setPage(0)}}><option value="">All platforms</option>{site.enabled_platforms.map(p=><option key={p} value={p}>{site.platforms?.find(x=>x.key===p)?.label||PLATFORM_LABELS[p]||p}</option>)}</select>
  </form>
  {error&&<p className="member-error" role="alert">{error} <button onClick={()=>setVersion(v=>v+1)}>Retry</button></p>}{message&&<p className="member-notice" role="status">{message}</p>}
  <div className="directory-results"><span>{busy?'Finding connections…':`${total.toLocaleString()} creator${total===1?'':'s'}`}</span><span>12 per page</span></div>
  {!busy&&!error&&paid.length>0&&<section className="paid-discovery" aria-label="Paid promotions"><h2>Paid promotions</h2><p>Sponsored placements · separate from organic results · no engagement guarantees</p><div className="directory-grid">{paid.map(p=>renderCard(p,p.promotion_id))}</div></section>}
  <h2 className="organic-heading">Community profiles</h2>
  {busy?<p className="member-empty" role="status">Loading creators…</p>:!rows.length&&!error?<div className="member-panel member-empty"><Search size={27}/><h2>No creators found</h2><p>Try another search. Member listings use purchased DC or launch rewards; profiles managed and published by the admin are free.</p>{user&&<Link to="/list-profile">List my profile →</Link>}</div>:<div className="directory-grid">{rows.filter(visible).map(p=>renderCard(p,`${p.managed?'listing':'user'}-${p.id}`))}</div>}
  <div className="member-pagination"><span>Page {page+1} of {Math.max(1,Math.ceil(total/12))}</span><div><button className="btn2" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="btn2" disabled={busy||(page+1)*12>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
  {report&&<dialog ref={dialog} className="member-dialog" aria-labelledby="report-title" onCancel={e=>{if(sending)e.preventDefault();else setReport(null)}}><form onSubmit={sendReport}><h2 id="report-title">Report @{report.username}</h2><p>Tell our moderation team what happened. Your report isn’t displayed publicly.</p><label className="text-sm">Reason<textarea className="mt-2" name="reason" required minLength={8} maxLength={500} rows={4}/></label>{reportError&&<p role="alert" className="member-error">{reportError}</p>}<div className="member-dialog-actions"><button type="button" disabled={sending} onClick={()=>setReport(null)}>Cancel</button><button className="member-primary" disabled={sending}>{sending?'Sending…':'Submit report'}</button></div></form></dialog>}
 </main>
}
