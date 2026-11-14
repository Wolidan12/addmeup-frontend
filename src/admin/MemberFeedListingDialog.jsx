import {useEffect,useRef,useState} from 'react'
import {useAuth} from '../context/AuthContext'
import {supabase} from '../lib/supabase'
import {InputError,publicError,withTimeout} from '../lib/errors'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const validDate=value=>value==null||Number.isFinite(Date.parse(value))
const date=value=>new Date(value).toLocaleString()
const pendingKey=(actor,target)=>`danqel_admin_member_feed_${actor}_${target}`
function memberFeedError(error){
 const message=typeof error?.message==='string'?error.message:''
 if(/Request reference unavailable/.test(message))return 'This saved request ID is already associated with another listing action. Check the member status and contact the platform owner before creating another request.'
 if(/Only member accounts can receive an admin feed feature/.test(message))return 'This complimentary feature is only available to registered member accounts, not staff accounts.'
 if(/New feed listings are paused/.test(message))return 'New feed listings are paused. No change was made; refresh eligibility before trying again.'
 if(/Choose the same available listing duration/.test(message))return 'That saved duration is no longer available. Refresh member status before creating a new listing request.'
 if(/Member profile must be public/.test(message))return 'The member must make their profile and a supported social link public, and be unrestricted, before listing.'
 if(/Member profile must be complete/.test(message))return 'The member must complete their name, username, photo, bio, country and at least one interest before an admin-sponsored listing.'
 if(/Member profile unavailable/.test(message))return 'This member profile is no longer available. No listing change was made.'
 if(/Permission denied/.test(message))return 'Your signed-in role cannot perform this member listing action.'
 return publicError(error,'We could not confirm this member listing action. Check status before retrying.')
}
function failedBeforeCommit(error){
 return error?.code==='42501'||(error?.code==='P0001'&&!/Request reference unavailable/.test(error.message||''))
}
function validateStatus(value,target){
 if(!value||value.user_id!==target||typeof value.member_account!=='boolean'||typeof value.profile_ready!=='boolean'||typeof value.profile_complete!=='boolean'||typeof value.enabled!=='boolean'||typeof value.eligible!=='boolean'||value.eligible!==(value.member_account&&value.profile_ready&&value.profile_complete&&value.enabled)||typeof value.listed_now!=='boolean'||!Number.isFinite(Date.parse(value.server_now))||!validDate(value.active_until)||!validDate(value.admin_until)||!validDate(value.paid_until)||!Array.isArray(value.packages))throw new Error('Invalid member listing status')
 if(value.packages.some(p=>!p||typeof p.key!=='string'||typeof p.label!=='string'||!Number.isInteger(p.duration_hours)||p.duration_hours<7||p.duration_hours>720)||new Set(value.packages.map(p=>p.key)).size!==value.packages.length)throw new Error('Invalid member listing options')
 return value
}
async function digest(value){
 if(!globalThis.crypto?.subtle)throw new InputError('Secure request confirmation is unavailable in this browser. No change was sent.')
 const bytes=new TextEncoder().encode(JSON.stringify(value)),hash=await globalThis.crypto.subtle.digest('SHA-256',bytes)
 return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')
}
function readPending(actor,target){
 const raw=localStorage.getItem(pendingKey(actor,target));if(!raw)return null
 let value;try{value=JSON.parse(raw)}catch{throw new InputError('A saved listing request could not be read. Check the member status and contact the platform owner before trying again.')}
 const validReason=typeof value?.reason==='string'&&value.reason===value.reason.trim()&&value.reason.length>=8&&value.reason.length<=1000
 if(!value||!uuid.test(value.id)||!['grant','revoke'].includes(value.kind)||value.actor!==actor||value.target!==target||!/^[0-9a-f]{64}$/.test(value.payload_hash)||!validReason||(value.kind==='grant'&&(typeof value.package_key!=='string'||!Number.isInteger(value.duration_hours)||value.duration_hours<7||value.duration_hours>720)))throw new InputError('A saved listing request needs review. Check the member status and contact the platform owner before trying again.')
 return value
}

export default function MemberFeedListingDialog({operation,onClose,onSaved}){
 const {user}=useAuth(),row=operation?.row||{},target=row.id||row.user_id||'',identity=row.display_name||row.username||'Member'
 const dialog=useRef(null),inFlight=useRef(false),pendingRef=useRef(null)
 const [status,setStatus]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retryStatus,setRetryStatus]=useState(0),[mode,setMode]=useState('grant'),[packageKey,setPackageKey]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[pending,setPending]=useState(null),[storageError,setStorageError]=useState(false)
 useEffect(()=>{if(dialog.current&&!dialog.current.open)dialog.current.showModal()},[])
 useEffect(()=>{
  try{
   const saved=readPending(user?.id||'',target)
   pendingRef.current=saved;setPending(saved);setMode(saved?.kind||'grant');setReason(saved?.reason||'');setPackageKey(saved?.kind==='grant'?saved.package_key:'');setConfirmed(false);setStorageError(false)
  }catch{pendingRef.current=null;setPending(null);setStorageError(true)}
 },[user?.id,target])
 useEffect(()=>{
  let current=true
  setLoading(true);setStatus(null);setError('')
  ;(async()=>{
   if(!uuid.test(target))throw new Error('Invalid member reference')
   const {data,error:rpcError}=await withTimeout(supabase.rpc('admin_member_feed_status',{p_user:target}))
   if(rpcError)throw rpcError
   const result=validateStatus(data,target)
   if(current){setStatus(result);setPackageKey(key=>pendingRef.current?.kind==='grant'?pendingRef.current.package_key:(result.packages.some(p=>p.key===key)?key:(result.packages[0]?.key||'')))}
  })().catch(e=>{if(current)setError(publicError(e,'Member listing controls are unavailable. No changes were made.'))}).finally(()=>{if(current)setLoading(false)})
  return()=>{current=false}
 },[target,retryStatus])
 useEffect(()=>{if(pending)setMode(pending.kind)},[pending])
 const pkg=status?.packages.find(p=>p.key===packageKey)
 const expectedHours=pending?.kind==='grant'?pending.duration_hours:pkg?.duration_hours
 const latestAdminEnd=status?.admin_until&&Date.parse(status.admin_until)>Date.parse(status.server_now)
 const latestPaidEnd=status?.paid_until&&Date.parse(status.paid_until)>Date.parse(status.server_now)
 const payloadFor=(kind,hours)=>kind==='grant'
  ?{p_user:target,p_package:packageKey,p_expected_hours:hours,p_reason:reason.trim(),p_member_authorized:true}
  :{p_user:target,p_reason:reason.trim(),p_confirm:true}
 const payloadIdentity=(kind,hours)=>kind==='grant'
  ?['grant',target,packageKey,hours,reason.trim(),true]
  :['revoke',target,reason.trim(),true]
 function clearRejectedPending(){
  try{localStorage.removeItem(pendingKey(user.id,target));pendingRef.current=null;setStorageError(false);setPending(null);setReason('')}
  catch{setStorageError(true)}
 }
 function finishPending(saved){
  try{localStorage.removeItem(pendingKey(user.id,target));pendingRef.current=null;setStorageError(false);setPending(null);setReason('')}
  catch{pendingRef.current=saved;setPending(saved)}
 }
 function validateGrantResult(value,requestId,body,expected){
  if(!value||value.id!==requestId||value.user_id!==target||value.package_key!==body.p_package||value.duration_hours!==expected||value.cost_dc!==0||value.source!=='admin_feature'||!Number.isFinite(Date.parse(value.starts_at))||!Number.isFinite(Date.parse(value.ends_at))||Date.parse(value.ends_at)-Date.parse(value.starts_at)!==value.duration_hours*3600000)throw new Error('Unconfirmed admin listing result')
 }
 async function submit(event){
  event.preventDefault();if(inFlight.current)return
  setError('')
  if(!user?.id||!uuid.test(target))return setError('This member listing request could not be verified. No change was sent.')
  if(!confirmed)return setError(mode==='grant'?'Confirm that the member authorized this public listing.':'Confirm that only admin-sponsored time will be ended.')
  if(reason.trim().length<8||reason.trim().length>1000)return setError('Enter an 8–1000 character reason.')
  if(mode==='grant'&&!pending&&(!status?.eligible||!pkg))return setError('This profile is not eligible for an admin-sponsored listing right now.')
  if(mode==='grant'&&pending?.kind==='grant'&&(pending.package_key!==packageKey||pending.duration_hours!==expectedHours))return setError('Retry the saved grant with its original duration and reason.')
  if(mode==='revoke'&&!pending&&!latestAdminEnd)return setError('There is no current or scheduled admin-sponsored time to end.')
  if(storageError)return setError('Saved request storage needs review. Do not create another listing request.')
  inFlight.current=true;setBusy(true)
  let saved=null,receivedResponse=false
  try{
   const body=payloadFor(mode,expectedHours),payloadHash=await digest(payloadIdentity(mode,expectedHours))
   saved=pending||{id:crypto.randomUUID(),kind:mode,actor:user.id,target,payload_hash:payloadHash,reason:reason.trim(),package_key:mode==='grant'?packageKey:undefined,duration_hours:mode==='grant'?expectedHours:undefined}
   if(!uuid.test(saved.id)||saved.kind!==mode||saved.actor!==user.id||saved.target!==target||saved.payload_hash!==payloadHash)throw new InputError('A previous request may still be processing. Retry with the exact same listing duration and reason, or check status before starting another.')
   if(!pending){
    try{localStorage.setItem(pendingKey(user.id,target),JSON.stringify(saved));pendingRef.current=saved;setPending(saved)}
    catch{saved=null;setStorageError(true);throw new InputError('Enable browser storage so this audited action can be retried safely. No request was sent.')}
   }
   const rpcName=mode==='grant'?'admin_grant_member_feed':'admin_revoke_member_feed'
   const result=await withTimeout(supabase.rpc(rpcName,{...body,p_request:saved.id}));receivedResponse=true
   if(result.error){if(failedBeforeCommit(result.error))clearRejectedPending();throw result.error}
   if(mode==='grant'){
    validateGrantResult(result.data,saved.id,body,saved.duration_hours)
    finishPending(saved)
    onSaved?.(`Member profile listing scheduled. Complimentary ${result.data.duration_hours} hours starts ${date(result.data.starts_at)}. The member was notified; normal privacy and feed eligibility rules still apply.`)
   }else{
    const value=result.data
    if(!value||value.user_id!==target||!Number.isInteger(value.revoked_count)||value.revoked_count<0||typeof value.listed_now!=='boolean')throw new Error('Unconfirmed admin listing result')
    finishPending(saved)
    onSaved?.(`Admin-sponsored time ended. ${value.revoked_count} sponsored booking${value.revoked_count===1?'':'s'} removed; paid listing time and wallet balances were not changed.`)
   }
  }catch(e){
   if(!receivedResponse&&saved){pendingRef.current=saved;setPending(saved);setReason(saved.reason);setConfirmed(false)}
   setError(e instanceof InputError?e.message:e?.code==='request_timeout'||!receivedResponse
    ?'The result is not confirmed. Retry this same request and reason; do not create a second listing action.'
    :memberFeedError(e))
  }finally{inFlight.current=false;setBusy(false)}
 }
 const refreshStatus=()=>setRetryStatus(value=>value+1)
 const close=()=>{if(!busy)onClose?.()}
 const statusLine=loading?'Checking server-side eligibility…':status?.listed_now?'The profile is currently listed in the community feed.':status?.admin_until&&!status.profile_complete?'Admin-sponsored time is hidden until the profile-complete badge is earned; its clock is unchanged.':status?.active_until?'Listing time is scheduled, but is not live yet.':'No current or scheduled feed listing.'
 return <dialog ref={dialog} className="ad-dialog member-feed-dialog" aria-labelledby="member-feed-title" onCancel={e=>{if(busy)e.preventDefault();else close()}}>
  <form onSubmit={submit}>
   <p className="ad-eyebrow">REGISTERED MEMBER · AUDITED FEED CONTROL</p>
   <h2 id="member-feed-title">List a member profile</h2>
   <p>Target: <strong>{identity}</strong>{row.username&&<> · @{row.username}</>}</p>
   <p className="ad-muted">This uses the member’s saved username, profile and public links. It is not a managed listing, creates no account, and never changes the member’s DC balance or the existing package prices.</p>
   {loading?<p role="status">Checking listing eligibility…</p>:status&&<>
    <dl className="member-feed-status">
     <div><dt>Registered member account</dt><dd>{status.member_account?'Yes':'No — staff accounts cannot receive this feature'}</dd></div>
     <div><dt>Public profile & social-link eligibility</dt><dd>{status.profile_ready?'Ready':'Not ready'}</dd></div>
     <div><dt>Profile-complete badge</dt><dd>{status.profile_complete?'Earned · shown on the feed':'Not earned · required for admin-sponsored listing'}</dd></div>
     <div><dt>Listing availability</dt><dd>{status.enabled?'Open':'New listings are paused'}</dd></div>
     <div><dt>Feed status</dt><dd>{statusLine}</dd></div>
     {status.paid_until&&<div><dt>Member-paid time booked through</dt><dd>{date(status.paid_until)}</dd></div>}
     {status.admin_until&&<div><dt>Admin-sponsored time booked through</dt><dd>{date(status.admin_until)}</dd></div>}
    </dl>
    {!status.member_account&&<p className="ad-error">Only a regular registered member account can receive this feature. Existing paid listing time is never changed.</p>}
    {!status.profile_ready&&<p className="ad-notice">The saved profile must be public, unrestricted, and have an eligible public social link. Ask the member to update their own settings; this action cannot bypass privacy or restrictions.</p>}
    {!status.profile_complete&&<p className="ad-notice">The member must complete their name, signup username, photo, bio, country and at least one interest. The existing “Profile complete” badge will then appear in the feed; this is not identity verification, and an admin cannot mark it manually. New admin-sponsored visibility is blocked until then.</p>}
    {!status.profile_complete&&status.admin_until&&<p className="ad-notice">Existing admin-sponsored hours are hidden from the feed while the badge is incomplete; their clock is not extended. Member-paid listing time remains on its existing path.</p>}
    {!status.enabled&&<p className="ad-notice">New listing actions are paused. No feed time or balance will change.</p>}
   </>}
   {pending&&<p className="ad-notice" role="status">A saved request may still be processing. Retry the same action with the exact same duration and reason. Do not start a second request.</p>}
   {storageError&&<p className="ad-error" role="alert">A saved request could not be read or stored. Check the member status and contact the platform owner before trying again.</p>}
   {!pending&&<div className="member-feed-mode" aria-label="Member listing actions">
    <button type="button" aria-pressed={mode==='grant'} disabled={busy} onClick={()=>{setMode('grant');setReason('');setConfirmed(false);setError('')}}>Schedule complimentary time</button>
    <button type="button" aria-pressed={mode==='revoke'} disabled={busy||!latestAdminEnd} onClick={()=>{setMode('revoke');setReason('');setConfirmed(false);setError('')}}>End admin-sponsored time</button>
   </div>}
   {mode==='grant'?<>
    <label>Listing duration<select aria-label="Listing duration" required value={packageKey} disabled={busy||loading||!!pending||!status?.eligible} onChange={e=>setPackageKey(e.target.value)}>
     {pending?.kind==='grant'&&!status?.packages.some(p=>p.key===pending.package_key)&&<option value={pending.package_key}>Saved duration · {pending.duration_hours} hours</option>}
     {status?.packages.map(p=><option key={p.key} value={p.key}>{p.label} · complimentary · {p.duration_hours} hours</option>)}
    </select></label>
    <p className="ad-muted">This feature costs the member 0 DC. It starts now or queues after any already-booked paid or admin-sponsored time. Hiding the profile or public links hides the listing but does not pause its clock.</p>
    {latestPaidEnd&&<p className="ad-muted">Member-paid listing time is preserved. Complimentary time will be scheduled after existing bookings.</p>}
    <label>Reason / internal audit note<textarea required minLength={8} maxLength={1000} value={reason} disabled={busy||!!pending} onChange={e=>setReason(e.target.value)} placeholder="Record the member's request and why a complimentary listing period is appropriate."/></label>
    <label className="member-feed-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/><span>I confirmed that the member authorized publishing their saved public profile and reviewed the requested listing duration.</span></label>
   </>:<>
    <p>This ends only current or scheduled admin-sponsored time. It does not delete or edit the profile, cancel or reschedule member-paid orders, or change any balance.</p>
    <label>Reason / internal audit note<textarea required minLength={8} maxLength={1000} value={reason} disabled={busy||!!pending} onChange={e=>setReason(e.target.value)} placeholder="Record why admin-sponsored time should end."/></label>
    <label className="member-feed-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/><span>I authorize ending admin-sponsored listing time only. Member-paid time and wallet balances must remain unchanged.</span></label>
   </>}
   {error&&<p className="ad-error" role="alert">{error} <button type="button" disabled={busy||loading} onClick={refreshStatus}>Refresh member status</button></p>}
   <div className="ad-dialog-actions"><button type="button" disabled={busy} onClick={close}>{busy?'Working…':'Close'}</button><button className="ad-primary" disabled={busy||loading||!status||storageError||!confirmed||reason.trim().length<8||(mode==='grant'&&!pending&&(!status.eligible||!pkg))||(mode==='revoke'&&!pending&&!latestAdminEnd)}>{busy?'Saving…':pending?'Retry same request':mode==='grant'?'Schedule listing time':'End admin time'}</button></div>
  </form>
 </dialog>
}
