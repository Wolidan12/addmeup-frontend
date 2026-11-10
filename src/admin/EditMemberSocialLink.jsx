import {useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {publicError,withTimeout} from '../lib/errors'
import {socialHref,validSocialUrl} from '../lib/validation'
import {useSite} from '../context/SiteContext'

const PLATFORM_LABELS={whatsapp:'WhatsApp',snapchat:'Snapchat',instagram:'Instagram',tiktok:'TikTok',facebook:'Facebook',x:'X',youtube:'YouTube',telegram:'Telegram'}

export default function EditMemberSocialLink({link,onCancel,onSaved}){
 const site=useSite(),[url,setUrl]=useState(link.url||''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[attempted,setAttempted]=useState(false),[error,setError]=useState('')
 const request=useRef(null),retryPayload=useRef(null),label=site.platforms?.find(p=>p.key===link.platform)?.label||PLATFORM_LABELS[link.platform]||link.platform
 const trimmed=url.trim(),valid=validSocialUrl(link.platform,trimmed,site.platforms),normalized=valid?socialHref(link.platform,trimmed):'',unchanged=valid&&normalized===link.url
 const submit=async event=>{
  event.preventDefault();setError('')
  if(!valid){setError(link.platform==='whatsapp'?'Enter a valid WhatsApp number or wa.me link.':'Enter an official HTTPS profile link for this platform.');return}
  if(reason.trim().length<8||reason.trim().length>1000){setError('Add a reason of 8–1000 characters. Do not include unnecessary private details.');return}
  if(!confirmed){setError('Confirm that the member requested and authorized this correction.');return}
  const payload={url:normalized,reason:reason.trim()}
  if(attempted&&JSON.stringify(payload)!==retryPayload.current){setError('A previous request may still be processing. Retry that exact change or cancel and reload the link.');return}
  if(!request.current)request.current=crypto.randomUUID()
  retryPayload.current=JSON.stringify(payload);setAttempted(true);setBusy(true)
  try{
   const {error:rpcError}=await withTimeout(supabase.rpc('admin_update_member_social_link',{
    p_link:link.id,p_url:normalized,p_reason:reason.trim(),p_member_confirmed:true,p_request:request.current,
   }))
   if(rpcError){
    // An explicit API/database error means the transaction was rejected. A
    // timeout or network failure is ambiguous, so keep its exact retry key.
    if(rpcError.code&&rpcError.code!=='FETCH_ERROR'){request.current=null;retryPayload.current=null;setAttempted(false)}
    throw rpcError
   }
   onSaved?.(`${label} link corrected. The public profile now uses the updated link.`)
  }catch(e){setError(publicError(e,'The correction could not be confirmed. Retry the same change or cancel and reload before trying again.'))}
  finally{setBusy(false)}
 }
 return <form className="member-social-editor" onSubmit={submit} aria-label={`Correct public ${label} link`}>
  <h4>Correct public {label} link</h4>
  <p className="ad-muted">This replaces only the link URL. Public visibility, profile ownership and any feed-listing time stay unchanged.</p>
  <label>Current public link<code className="member-social-current">{link.url}</code></label>
  <label htmlFor={`member-social-url-${link.id}`}>{link.platform==='whatsapp'?'New WhatsApp number or wa.me link':`New official ${label} profile URL`}
   <input id={`member-social-url-${link.id}`} type="text" autoComplete="off" maxLength={500} value={url} disabled={busy||attempted} onChange={e=>setUrl(e.target.value)} placeholder={link.platform==='whatsapp'?'+234 800 000 0000 or https://wa.me/2348000000000':'https://…'}/>
  </label>
  <label htmlFor={`member-social-reason-${link.id}`}>Reason for correction
   <textarea id={`member-social-reason-${link.id}`} rows={2} minLength={8} maxLength={1000} value={reason} disabled={busy||attempted} onChange={e=>setReason(e.target.value)} placeholder="Member asked us to correct a typo in their public link."/>
  </label>
  <label className="member-social-consent"><input type="checkbox" checked={confirmed} disabled={busy||attempted} onChange={e=>setConfirmed(e.target.checked)}/><span>I confirm the member requested this correction and I verified the replacement link with them.</span></label>
  {unchanged&&<p className="ad-muted">The replacement is identical to the current link.</p>}
  {error&&<p className="ad-error" role="alert">{error}</p>}
  {attempted&&<p className="ad-notice" role="status">Retry keeps the same request reference. Do not start a second change until this one is confirmed.</p>}
  <div className="admin-list-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel and reload</button><button className="ad-primary" disabled={busy||!valid||unchanged||!confirmed||reason.trim().length<8}>{busy?'Saving correction…':attempted?'Retry same correction':'Save verified correction'}</button></div>
 </form>
}
