import ReceiptEvidence from './ReceiptEvidence'
import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
export default function ActionDialog({operation,onClose,onSaved}){
 const dialog=useRef(null),request=useRef(crypto.randomUUID()),[reason,setReason]=useState(''),[value,setValue]=useState(''),[title,setTitle]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[bankReference,setBankReference]=useState('')
 const {action,label,row}=operation
 useEffect(()=>{dialog.current.showModal()},[])
 async function submit(e){e.preventDefault();setError('');setBusy(true)
  const payload=action==='adjust_points'?{points:Number(value)}:action==='configure_reward'?{value:Number(value)}:action==='set_role'?{role:value}:action==='toggle_task'?{enabled:!row.is_active}:action==='notify'?{title,body}:{}
  try{
   const {error}=['approve_bank','reject_bank'].includes(action)
    ?await supabase.rpc('admin_review_bank_order',{p_order:row.id,p_approve:action==='approve_bank',p_bank_reference:bankReference,p_reason:reason.trim()})
    :action==='verify_payment'
    ?await supabase.functions.invoke('verify-payment',{body:{reference:row.reference,reason:reason.trim()}})
    :await supabase.rpc('admin_mutate',{p_action:action,p_target:row.id||row.user_id||row.key,p_value:payload,p_reason:reason.trim(),p_request:request.current})
   if(error)throw error
   onSaved(`${label} completed and audit-logged.`);onClose()
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <dialog ref={dialog} className="ad-dialog" aria-labelledby="action-title" onCancel={e=>{if(busy)e.preventDefault();else onClose()}}>
 <form onSubmit={submit}><div className="ad-eyebrow">CONTROLLED ACTION</div><h2 id="action-title">{label}</h2><p>Target: <code>{row.username||row.id||row.user_id||row.key}</code></p><p className="ad-muted">This action changes live data. Authorization is checked in the database and the action is recorded in the audit trail.</p>
 {['approve_bank','reject_bank'].includes(action)&&<><p>{row.package_title} · {row.points} points · NGN {(row.amount_kobo/100).toLocaleString()}<br/>Payer: {row.payer_name}<br/>Transfer reference: {row.transfer_reference}</p><ReceiptEvidence path={row.receipt_path}/></>}
 {action==='approve_bank'&&<><label>Unique transaction ID from the receiving bank statement<input required minLength={4} maxLength={120} value={bankReference} onChange={e=>setBankReference(e.target.value)}/></label><label className="flex gap-2"><input className="w-auto" type="checkbox" required/>I checked the receiving bank statement, confirmed the exact amount was received, and this transfer has not funded another order.</label></>}
 {['adjust_points','configure_reward'].includes(action)&&<label>{action==='adjust_points'?'Signed points adjustment (±100,000)':row.key==='referral_purchase_percent'?'New referral percentage (0–50)':'New value (0–10,000)'}<input type="number" required step="1" min={action==='adjust_points'?-100000:0} max={action==='adjust_points'?100000:row.key==='referral_purchase_percent'?50:10000} value={value} onChange={e=>setValue(e.target.value)}/></label>}
 {action==='set_role'&&<label>New role<select required value={value} onChange={e=>setValue(e.target.value)}><option value="">Choose role</option>{['user','super_admin','moderator','finance_admin','support_agent'].map(x=><option key={x}>{x}</option>)}</select></label>}
 {action==='notify'&&<><label>Title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Message<textarea required maxLength={2000} value={body} onChange={e=>setBody(e.target.value)}/></label></>}
 <label>Reason / internal note<textarea required minLength={8} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain why this action is necessary…"/></label>
 {error&&<p className="ad-error" role="alert">{error}</p>}<div className="ad-dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="ad-primary" disabled={busy||reason.trim().length<8}>{busy?'Applying…':'Confirm action'}</button></div></form></dialog>
}
