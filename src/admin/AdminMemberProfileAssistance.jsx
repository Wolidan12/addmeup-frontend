import {useEffect,useRef,useState} from 'react'
import {useSite} from '../context/SiteContext'
import {publicError,withTimeout} from '../lib/errors'
import {socialHref,validSocialUrl,USERNAME_RE} from '../lib/validation'
import {backendUpgradeRequired} from './backendCompatibility'
import {supabase} from '../lib/supabase'

const fieldLabels={
 display_name:'Display name',
 username:'Signup username',
 avatar_url:'Profile photo URL',
 bio:'Bio',
 country:'Country',
 interests:'At least one interest',
}
const fieldOrder=Object.keys(fieldLabels)
const emptyProfile={display_name:'',username:'',avatar_url:'',bio:'',country:'',interests:''}
const pendingKey=(actor,target)=>`danqel_admin_profile_assist_${actor}_${target}`
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readPending(actor,target){
 const raw=localStorage.getItem(pendingKey(actor,target))
 if(!raw)return null
 let saved
 try{saved=JSON.parse(raw)}catch{throw new Error('Saved profile-assistance request could not be read')}
 if(!saved||saved.actor!==actor||saved.target!==target||!uuid.test(saved.id))throw new Error('Saved profile-assistance request needs review')
 return saved
}
function validateStatus(value,target){
 if(!value||value.user_id!==target||typeof value.member_account!=='boolean'||typeof value.profile_public!=='boolean'||typeof value.restricted!=='boolean'||typeof value.profile_complete!=='boolean'||typeof value.profile_ready!=='boolean'||typeof value.can_assist!=='boolean'||!Array.isArray(value.missing_fields)||!Array.isArray(value.available_social_platforms))throw new Error('Invalid profile-assistance status')
 if(value.missing_fields.some(field=>!fieldOrder.includes(field))||new Set(value.missing_fields).size!==value.missing_fields.length)throw new Error('Invalid missing profile fields')
 if(value.available_social_platforms.some(platform=>!platform||typeof platform.key!=='string'||typeof platform.label!=='string')||new Set(value.available_social_platforms.map(platform=>platform.key)).size!==value.available_social_platforms.length)throw new Error('Invalid public social platforms')
 const expected=value.member_account&&value.profile_public&&!value.restricted&&(value.missing_fields.length>0||!value.profile_ready)
 if(value.can_assist!==expected)throw new Error('Invalid profile-assistance eligibility')
 return value
}
function profileError(error){
 const message=typeof error?.message==='string'?error.message:''
 if(/That signup username is already taken/.test(message))return 'That username is already in use. Confirm the member’s chosen username and refresh status.'
 if(/Only a missing|Complete every currently missing/.test(message))return 'The member’s profile changed while this form was open. Refresh before trying again; filled values are never overwritten.'
 if(/already has a member link/.test(message))return 'That platform already has a member link. The member must manage its value and privacy in their own settings.'
 if(/official host|official HTTPS|WhatsApp number|enabled public social platform|social platform is unavailable/.test(message))return 'Use an enabled social platform and the member-supplied official profile link.'
 if(/must keep their profile public/.test(message))return 'The member must make their own profile public in account settings. No privacy setting was changed.'
 if(/Restricted member profiles/.test(message))return 'This account is restricted and cannot receive profile assistance or a listing.'
 if(/Only member accounts/.test(message))return 'Profile assistance is only for ordinary registered member accounts, not staff accounts.'
 if(/already complete and ready/.test(message))return 'This profile is already complete and ready. No changes were made.'
 if(/Profile completion did not pass|Add a supported new public link/.test(message))return 'The profile still needs a required detail or a supported public link. No partial change was saved.'
 if(/Permission denied/.test(message))return 'Your signed-in role cannot assist this member profile.'
 if(/Confirm the member/.test(message))return 'Confirm that the member supplied and authorized every submitted detail and public link.'
 if(/Request reference unavailable/.test(message))return 'This saved request ID was used for another action. Refresh status and contact the platform owner before retrying.'
 if(/reason/i.test(message))return 'Enter an internal audit reason of 8–1000 characters without unnecessary private information.'
 return publicError(error,'We could not confirm the profile update. Check member status before retrying.')
}
function parseInterests(value){return String(value||'').split(',').map(item=>item.trim()).filter(Boolean)}

export default function AdminMemberProfileAssistance({target,actor,refreshKey=0,parentBusy=false,onBusyChange,onRefresh,onSaved}){
 const site=useSite(),attempted=useRef(false),pendingRef=useRef(null),linkIndex=useRef(0)
 const [status,setStatus]=useState(null),[loading,setLoading]=useState(true),[unavailable,setUnavailable]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[storageError,setStorageError]=useState(false)
 const [profile,setProfile]=useState(emptyProfile),[links,setLinks]=useState([]),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[pending,setPending]=useState(null)
 const disabled=busy||parentBusy
 useEffect(()=>{
  try{const saved=readPending(actor,target);pendingRef.current=saved;setPending(saved);setStorageError(false)}
  catch{pendingRef.current=null;setPending(null);setStorageError(true)}
 },[actor,target])
 useEffect(()=>{
  let active=true
  setLoading(true);setUnavailable(false);setError('');setStatus(null)
  ;(async()=>{
   if(!uuid.test(target)||!uuid.test(actor))throw new Error('Invalid profile-assistance reference')
   const {data,error:rpcError}=await withTimeout(supabase.rpc('admin_member_profile_assist_status',{p_user:target}))
   if(rpcError)throw rpcError
   const value=validateStatus(data,target)
   if(active){
    setStatus(value)
    setConfirmed(false)
    if(!value.can_assist)clearPending()
    if(!value.profile_ready&&value.available_social_platforms.length){
     const first=value.available_social_platforms[0]
     setLinks([{id:`new-${linkIndex.current++}`,platform:first.key,url:''}])
    }else setLinks([])
   }
  })().catch(e=>{
   if(!active)return
   if(backendUpgradeRequired(e))setUnavailable(true)
   else setError(profileError(e))
  }).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[actor,target,refreshKey])
 const missingFields=fieldOrder.filter(field=>status?.missing_fields.includes(field))
 const labelFor=platform=>site.platforms?.find(item=>item.key===platform)?.label||platform
 const remainingPlatforms=(index)=>{
  const otherSelections=new Set(links.filter((_,i)=>i!==index).map(link=>link.platform).filter(Boolean))
  return (status?.available_social_platforms||[]).filter(platform=>!otherSelections.has(platform.key))
 }
 function setProfileField(name,value){setProfile(current=>({...current,[name]:value}));setConfirmed(false)}
 function setLink(index,patch){setLinks(current=>current.map((link,i)=>i===index?{...link,...patch}:link));setConfirmed(false)}
 function addLink(){
  const selected=new Set(links.map(link=>link.platform).filter(Boolean))
  const next=(status?.available_social_platforms||[]).find(platform=>!selected.has(platform.key))
  if(next&&links.length<8){setLinks(current=>[...current,{id:`new-${linkIndex.current++}`,platform:next.key,url:''}]);setConfirmed(false)}
 }
 function removeLink(index){setLinks(current=>current.filter((_,i)=>i!==index));setConfirmed(false)}
 function buildPayload(){
  if(!status?.can_assist)throw new Error('This member is not eligible for profile assistance')
  const profilePayload={}
  for(const field of missingFields){
   const raw=profile[field]
   const value=field==='username'?String(raw||'').trim().toLowerCase():String(raw||'').trim()
   if(field==='display_name'&&(value.length<2||value.length>60||value==='New creator'||/[<>\u0000-\u001f]/.test(value)))throw new Error('Enter the member-supplied display name (2–60 characters).')
   if(field==='username'&&!USERNAME_RE.test(value))throw new Error('Enter the member-selected username (3–24 lowercase letters, numbers or underscores).')
   if(field==='avatar_url'&&(!/^https:\/\//i.test(value)||value.length>1000||/[\s<>]/.test(value)))throw new Error('Enter the member-supplied HTTPS profile-photo URL.')
   if(field==='bio'&&(!value||value.length>280||/[<>]/.test(value)))throw new Error('Enter the member-supplied bio (1–280 characters).')
   if(field==='country'&&(!value||value.length>80||/[<>\u0000-\u001f]/.test(value)))throw new Error('Enter the member-supplied country (up to 80 characters).')
   if(field==='interests'){
    const items=parseInterests(raw)
    if(!items.length||items.length>10||items.some(item=>item.length>40||/[<>\u0000-\u001f]/.test(item)))throw new Error('Enter 1–10 member-supplied interests, separated by commas (up to 40 characters each).')
    profilePayload.interests=items
   }else profilePayload[field]=value
  }
  const linkPayload=[]
  for(const link of links){
   const platform=link.platform,url=String(link.url||'').trim()
   if(!platform&&!url)continue
   if(!platform||!status.available_social_platforms.some(item=>item.key===platform))throw new Error('Choose an available social platform for each new public link.')
   if(!validSocialUrl(platform,url,site.platforms))throw new Error(platform==='whatsapp'?'Enter a valid member-authorized WhatsApp number or wa.me link.':'Enter the member-supplied official HTTPS profile URL.')
   linkPayload.push({platform,url:socialHref(platform,url)})
  }
  if(!status.profile_ready&&!linkPayload.length)throw new Error('Add at least one new public social link, or ask the member to manage an existing link in their own settings.')
  if(new Set(linkPayload.map(link=>link.platform)).size!==linkPayload.length)throw new Error('Choose each social platform only once.')
  if(linkPayload.length>8)throw new Error('Add no more than 8 public links at a time.')
  if(reason.trim().length<8||reason.trim().length>1000)throw new Error('Enter an internal audit reason of 8–1000 characters.')
  if(!confirmed)throw new Error('Confirm that the member supplied and authorized every profile detail and public link.')
  return {profilePayload,linkPayload}
 }
 function storePending(value){
  try{localStorage.setItem(pendingKey(actor,target),JSON.stringify(value));pendingRef.current=value;setPending(value);setStorageError(false)}
  catch{setStorageError(true);throw new Error('Enable browser storage so this audited change can be retried safely. No request was sent.')}
 }
 function clearPending(){
  try{localStorage.removeItem(pendingKey(actor,target));pendingRef.current=null;setPending(null);setStorageError(false)}
  catch{setStorageError(true)}
 }
 async function submit(event){
  event?.preventDefault?.()
  setError('');setNotice('')
  if(attempted.current||disabled)return
  let requestData
  try{requestData=buildPayload()}catch(e){setError(e.message);return}
  attempted.current=true;setBusy(true);onBusyChange?.(true)
  let saved=null,receivedResponse=false
  try{
   saved=pendingRef.current
   if(!saved){
    const id=globalThis.crypto?.randomUUID?.()
    if(!id)throw new Error('Secure request confirmation is unavailable. No change was sent.')
    saved={id,actor,target}
    storePending(saved)
   }
   const response=await withTimeout(supabase.rpc('admin_assist_member_profile',{
    p_user:target,p_profile:requestData.profilePayload,p_social_links:requestData.linkPayload,
    p_reason:reason.trim(),p_member_authorized:true,p_request:saved.id,
   }))
   receivedResponse=true
   if(response.error){
    if(response.error.code&&response.error.code!=='FETCH_ERROR'){clearPending();pendingRef.current=null}
    throw response.error
   }
   const result=response.data
   if(!result||result.request_id!==saved.id||result.user_id!==target||result.profile_complete!==true||result.profile_ready!==true||!Array.isArray(result.updated_fields)||!Array.isArray(result.added_platforms)||result.launch_reward_awarded!==true&&result.launch_reward_awarded!==false)throw new Error('Unconfirmed profile-assistance result')
   clearPending();attempted.current=false
   setProfile(emptyProfile);setLinks([]);setReason('');setConfirmed(false)
   const reward=result.launch_reward_awarded?' The existing launch campaign also awarded its standard 5,000 DC reward under its normal eligibility and capacity rules.':' The existing launch-reward eligibility and capacity checks were left unchanged.'
   const message=`Member profile completed at their request. The completion badge is now derived from the saved profile; no badge was manually granted.${result.added_platforms.length?` Added public ${result.added_platforms.map(labelFor).join(', ')} link${result.added_platforms.length===1?'':'s'}.`:''}${reward}`
   setNotice(message);onSaved?.(message)
  }catch(e){
   if(saved&&!receivedResponse){pendingRef.current=saved;setPending(saved);setConfirmed(false)}
   setError(profileError(e))
  }finally{
   attempted.current=false;setBusy(false);onBusyChange?.(false)
  }
 }
 const canSubmit=status?.can_assist&&!storageError&&!disabled&&(!pending||uuid.test(pending.id))
 const noLinkOptions=status&&!status.profile_ready&&status.available_social_platforms.length===0
 return <section className="member-profile-assist" aria-labelledby="member-profile-assist-title" onKeyDown={event=>{if(event.key==='Enter'&&event.target.tagName!=='TEXTAREA')event.preventDefault()}}>
  <div className="member-profile-assist-heading"><div><p className="ad-eyebrow">MEMBER-APPROVED PROFILE SUPPORT</p><h3 id="member-profile-assist-title">Complete missing member details</h3></div></div>
  <p className="ad-muted">Use only member-supplied details. The badge reflects profile completion, not identity verification.</p>
  {loading?<p role="status">Checking which profile fields need attention…</p>:unavailable?<p className="ad-notice" role="status">Profile-assistance controls are not installed on this server yet. The existing listing checks remain active; no profile or link was changed.</p>:error&&!status?<p className="ad-error" role="alert">{error} <button type="button" disabled={disabled} onClick={()=>onRefresh?.()}>Refresh listing status</button></p>:status&&<>
   {!status.member_account?<p className="ad-notice">Only an ordinary registered member account can receive profile assistance.</p>:status.restricted?<p className="ad-notice">This account is restricted. Admin assistance cannot bypass restrictions.</p>:!status.profile_public?<p className="ad-notice">The member must make their profile public in their own privacy settings before admin assistance. Privacy is never changed here.</p>:!status.can_assist?<p className="ad-muted">No missing completion details or public feed-eligibility changes are available for admin assistance.</p>:<>
    {missingFields.length>0?<fieldset className="member-profile-assist-fields"><legend>Missing fields · member supplied</legend>{missingFields.map(field=><label key={field} htmlFor={`member-assist-${field}-${target}`}>
     <span>{fieldLabels[field]}{field==='username'?' · chosen by the member':''}</span>
     {field==='bio'?<textarea id={`member-assist-${field}-${target}`} rows={3} maxLength={280} value={profile[field]} disabled={disabled} onChange={event=>setProfileField(field,event.target.value)} placeholder="Use the member’s own words."/>:
      field==='interests'?<input id={`member-assist-${field}-${target}`} type="text" maxLength={410} value={profile[field]} disabled={disabled} onChange={event=>setProfileField(field,event.target.value)} placeholder="For example: music, design"/>:
      <input id={`member-assist-${field}-${target}`} type={field==='avatar_url'?'url':'text'} maxLength={field==='avatar_url'?1000:field==='display_name'?60:field==='username'?24:80} autoComplete="off" value={profile[field]} disabled={disabled} onChange={event=>setProfileField(field,field==='username'?event.target.value.toLowerCase():event.target.value)} placeholder={field==='display_name'?'Member-supplied public display name':field==='username'?'Member-selected username':field==='avatar_url'?'HTTPS photo URL supplied by the member':field==='country'?'Member-supplied country':''} autoCapitalize={field==='username'?'none':undefined}/>}
    </label>)}</fieldset>:null}
    {status.available_social_platforms.length>0&&<fieldset className="member-profile-assist-links"><legend>New public links · optional unless needed</legend><p className="ad-muted">New links only. Existing links and their privacy stay unchanged.</p>{links.map((link,index)=><div className="member-profile-assist-link" key={link.id}>
     <label htmlFor={`member-assist-platform-${link.id}`}><span>Platform</span><select id={`member-assist-platform-${link.id}`} value={link.platform} disabled={disabled} onChange={event=>setLink(index,{platform:event.target.value})}><option value="">Choose an enabled platform</option>{remainingPlatforms(index).map(platform=><option key={platform.key} value={platform.key}>{platform.label}</option>)}</select></label>
     <label htmlFor={`member-assist-url-${link.id}`}><span>Member-supplied public link</span><input id={`member-assist-url-${link.id}`} type="url" autoComplete="off" maxLength={500} value={link.url} disabled={disabled} onChange={event=>setLink(index,{url:event.target.value})} placeholder={link.platform==='whatsapp'?'+234 800 000 0000 or https://wa.me/2348000000000':'https://…'}/></label>
     <button type="button" disabled={disabled} onClick={()=>removeLink(index)} aria-label={`Remove new ${labelFor(link.platform||'social')} link`}>Remove</button>
    </div>)}<button className="member-profile-assist-add" type="button" disabled={disabled||links.length>=8||links.length>=status.available_social_platforms.length} onClick={addLink}>+ Add another public link</button></fieldset>}
    {noLinkOptions&&<p className="ad-notice">No unused platform is available. Ask the member to add or update a public link in their settings.</p>}
    {missingFields.length>0&&<p className="member-profile-assist-warning">Saving profile fields runs the normal launch-reward check. Eligible members may receive 5,000 DC if capacity remains; existing safeguards still apply.</p>}
    <label htmlFor={`member-assist-reason-${target}`}>Reason / internal audit note<textarea id={`member-assist-reason-${target}`} rows={2} minLength={8} maxLength={1000} value={reason} disabled={disabled} onChange={event=>{setReason(event.target.value);setConfirmed(false)}} placeholder="Record the member’s request. Avoid unnecessary personal information."/></label>
    <label className="member-profile-assist-consent"><input type="checkbox" checked={confirmed} disabled={disabled} onChange={event=>setConfirmed(event.target.checked)}/><span>I confirm the member supplied these details, approved any new links as public, and understands normal launch-reward rules may apply.</span></label>
    {pending&&<p className="ad-notice" role="status">A previous profile update may still be processing. Re-enter the exact same values and reason to retry; the values themselves are not stored in browser storage.</p>}
    {storageError&&<p className="ad-error" role="alert">A saved request could not be read or stored. Refresh member status and contact the platform owner before trying another request.</p>}
    {error&&status&&<p className="ad-error" role="alert">{error}</p>}
    {notice&&<p className="ad-notice" role="status">{notice}</p>}
    <div className="member-profile-assist-actions"><button className="ad-primary" type="button" disabled={!canSubmit||!confirmed||reason.trim().length<8||!missingFields.every(field=>String(profile[field]||'').trim())||noLinkOptions} onClick={submit}>{busy?'Saving…':pending?'Retry same save':'Save profile details'}</button><button type="button" disabled={disabled} onClick={()=>onRefresh?.()}>Refresh status</button></div>
   </>}
  </>}
 </section>
}
