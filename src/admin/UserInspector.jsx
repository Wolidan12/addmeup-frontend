import {backendUpgradeRequired} from './backendCompatibility'
import {RecordFields} from './AdminWorkflow'
import EditMemberSocialLink from './EditMemberSocialLink'
import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {publicError,withTimeout} from '../lib/errors'

const tabsFor=role=>role==='super_admin'?['profile','social','wallet','deposits','connections','referrals','missions','support']:role==='finance_admin'?['profile','wallet','deposits','referrals','support']:role==='moderator'?['profile','social','connections','referrals']:['profile','connections','referrals','support']
const platformLabel=key=>({whatsapp:'WhatsApp',snapchat:'Snapchat',instagram:'Instagram',tiktok:'TikTok',facebook:'Facebook',x:'X',youtube:'YouTube',telegram:'Telegram'}[key]||key)

export default function UserInspector({id,role,snapshot,isSelf=false,actions=[],onAction,onClose}){
 const dialog=useRef(null),[tab,setTab]=useState('profile'),[page,setPage]=useState(0),[data,setData]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[tick,setTick]=useState(0),[limited,setLimited]=useState(false),[editingLink,setEditingLink]=useState(null),[notice,setNotice]=useState('')
 useEffect(()=>{dialog.current.showModal()},[])
 useEffect(()=>{
  let active=true
  setBusy(true);setError('');setData(null);setLimited(false)
  const load=async()=>{
   if(tab==='social'){
    const {data:rows,error}=await withTimeout(supabase.from('social_links').select('id,profile_id,platform,url,is_public').eq('profile_id',id).eq('is_public',true).order('platform'))
    if(error)throw error
    if(!Array.isArray(rows))throw new Error('Invalid public social-link response')
    return {rows:rows.filter(row=>row.profile_id===id&&row.is_public),total:rows.length}
   }
   const {data:details,error}=await withTimeout(supabase.rpc('admin_user_detail',{p_user:id,p_section:tab,p_page:page}))
   if(error)throw error
   return details
  }
  load().then(value=>{if(active)setData(value)}).catch(e=>{
   if(!active)return
   if(tab!=='social'&&backendUpgradeRequired(e)){
    setLimited(true)
    if(tab==='profile'&&snapshot?.id===id)setData({profile:snapshot})
   }else setError(publicError(e,'Member details could not be loaded.'))
  }).finally(()=>{if(active)setBusy(false)})
  return()=>{active=false}
 },[id,tab,page,tick,snapshot])
 const closeEditor=()=>{setEditingLink(null);setNotice('');setTick(v=>v+1)}
 const savedEditor=message=>{setEditingLink(null);setNotice(message);setTick(v=>v+1)}
 const publicLinks=tab==='social'?(data?.rows||[]):[]
 const canCorrect=(role==='super_admin'||role==='moderator')&&!isSelf
 return <dialog className="ad-dialog user-inspector" ref={dialog} aria-labelledby="user-inspector-title" onCancel={onClose}>
  <p className="ad-eyebrow">TRUSTED MEMBER INSPECTION</p>
  <h2 id="user-inspector-title">Account, eligibility & activity</h2>
  <p>{snapshot?.display_name||snapshot?.username||'Member'}</p>
  <code>{id}</code>
  <nav className="relationship-tabs" aria-label="Member record sections">{tabsFor(role).map(t=><button type="button" key={t} aria-pressed={t===tab} onClick={()=>{setTab(t);setPage(0);setEditingLink(null);setNotice('')}}>{t}</button>)}</nav>
  {limited&&<p className="ad-notice" role="status">{tab==='profile'?'Showing the protected user-list record. Extended account history is not available on this server yet.':'This account history tool is not available on the current server. Open Profile to see the protected user-list details.'}</p>}
  {notice&&<p className="ad-notice" role="status">{notice}</p>}
  {error&&<p role="alert" className="ad-error">{error}<button type="button" onClick={()=>setTick(v=>v+1)}>Retry member details</button></p>}
  {busy?<p role="status">Loading protected member records…</p>:!data?(!limited&&<p>Account unavailable.</p>):tab==='profile'?<div>{Object.entries(data).map(([section,value])=><section key={section}><h3>{section}</h3><RecordFields record={value||{}} display={(k,v)=>v==null?'—':typeof v==='boolean'?(v?'Yes':'No'):String(v)}/></section>)}</div>:tab==='social'?<section className="member-social-list" aria-label="Public social links">
   <p className="ad-muted">Only links already public on this member’s profile are shown here. A correction does not change visibility or listing time.</p>
   {publicLinks.map(row=><article className="inspector-record member-social-record" key={row.id}>
    <header><h3>{platformLabel(row.platform)}</h3><span className="ad-status">Public profile link</span></header>
    <code className="member-social-current">{row.url}</code>
    {editingLink?.id===row.id?<EditMemberSocialLink link={editingLink} onCancel={closeEditor} onSaved={savedEditor}/>:canCorrect?<button type="button" onClick={()=>{setNotice('');setEditingLink(row)}}>Correct public link</button>:isSelf?<p className="ad-muted">Use Account settings to correct your own social link.</p>:null}
   </article>)}
   {!publicLinks.length&&<p>No currently public social links are available to correct.</p>}
   {role==='finance_admin'&&<p className="ad-muted">Your role can inspect financial records, but cannot edit social links.</p>}
  </section>:<>
   {data.balance!=null&&<h3>Available balance: {Number(data.balance).toLocaleString()} DC</h3>}
   {data.rows?.map((row,i)=><article className="inspector-record" key={row.id||i}><dl>{Object.entries(row).map(([key,v])=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{v==null?'—':typeof v==='object'?JSON.stringify(v):String(v)}</dd></div>)}</dl></article>)}
   {!data.rows?.length&&<p>No records in this section.</p>}
   <div className="member-pagination"><span>Page {page+1} · {data.total} records</span><button type="button" disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous member records</button><button type="button" disabled={(page+1)*25>=data.total} onClick={()=>setPage(p=>p+1)}>Next member records</button></div>
  </>}
  {data&&!error&&tab==='profile'&&onAction&&<details className="admin-member-actions"><summary>Manage this user</summary><div className="admin-list-actions">{actions.map(a=><button type="button" key={a.action} onClick={()=>onAction({...a,row:snapshot})}>{a.label}</button>)}</div><p>Each action opens its own reasoned confirmation. Nothing changes by opening this menu.</p></details>}
  <p>Financial corrections, restrictions and role changes use separate reasoned actions. Public social-link corrections require member authorization and are logged. The complimentary registered-member feed action uses a separate consent-checked audit path; it never edits balances, XP, profile ownership or member-paid listing time.</p>
  <button type="button" className="ad-primary" onClick={onClose}>Close member inspection</button>
 </dialog>
}
