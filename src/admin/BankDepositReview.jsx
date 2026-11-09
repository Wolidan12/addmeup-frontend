import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {publicError,withTimeout} from '../lib/errors'
import ReceiptEvidence from './ReceiptEvidence'
import {bankReviewPayload,declineReasons} from './bankReview'
import './bankReview.css'
const money=k=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(Number(k)/100)
export default function BankDepositReview({operation,onClose,onSaved}){
 const {row}=operation,approve=operation.action==='approve_bank',dialog=useRef(null),inFlight=useRef(false)
 const [reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false),[declineReason,setDeclineReason]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[showReceipt,setShowReceipt]=useState(false)
 useEffect(()=>{dialog.current?.showModal()},[])
 async function submit(e){e.preventDefault();if(inFlight.current)return;setError('')
  try{
   const payload=bankReviewPayload(row,{approve,reference,confirmed,declineReason,note});inFlight.current=true;setBusy(true)
   const {error}=await withTimeout(supabase.rpc('admin_confirm_manual_deposit',payload));if(error)throw error
   onSaved(approve?'Deposit approved and audit-logged. Wallet credited once.':'Deposit declined and audit-logged. No wallet credit.');onClose()
  }catch(e){setError(publicError(e,'The deposit could not be reviewed. Refresh the list before retrying if its status changed.'))}finally{inFlight.current=false;setBusy(false)}
 }
 return <dialog ref={dialog} className="ad-dialog bank-review" aria-labelledby="bank-review-title" onCancel={e=>{if(busy)e.preventDefault();else onClose()}}><form onSubmit={submit}>
 <header><span className="ad-eyebrow">MANUAL DEPOSIT</span><h2 id="bank-review-title">{approve?'Approve deposit':'Decline deposit'}</h2><p>{row.username||row.email||'Member'} · {money(row.amount_kobo)} → {Number(row.points).toLocaleString()} DC</p></header>
 <dl className="bank-review-facts"><div><dt>Payer</dt><dd>{row.payer_name||'Not supplied'}</dd></div><div><dt>Member’s reference</dt><dd>{row.transfer_reference||'Not supplied'}</dd></div></dl>
 <details className="bank-review-evidence" onToggle={e=>setShowReceipt(e.currentTarget.open)}><summary>View receipt and order details</summary><p>Order: <code>{row.id}</code></p><p>{row.bank_name} · {row.account_number}<br/>{row.account_name}</p>{showReceipt&&<ReceiptEvidence path={row.receipt_path} compact/>}</details>
 {approve?<><label>Bank-statement reference<input aria-label="Bank-statement reference" required minLength={4} maxLength={120} autoComplete="off" disabled={busy} value={reference} onChange={e=>setReference(e.target.value)} placeholder="From the receiving bank, not the uploaded receipt"/></label><label className="bank-review-confirm"><input type="checkbox" required checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/><span>I checked the bank statement: {money(row.amount_kobo)} was received in Moniepoint {row.account_number}, and this transfer has not funded another order.</span></label></>:<label>Decline reason<select aria-label="Decline reason" required disabled={busy} value={declineReason} onChange={e=>setDeclineReason(e.target.value)}><option value="">Choose a reason</option>{Object.entries(declineReasons).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
 {(!approve&&declineReason==='other')?<label>Reason for declining<textarea aria-label="Reason for declining" required minLength={8} maxLength={800} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></label>:<details className="bank-review-notes"><summary>Add an optional note</summary><label>Optional note<textarea aria-label="Optional note" maxLength={800} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></label></details>}
 <p className="bank-review-disclosure">{approve?'A receipt alone is not proof of payment. Approve only after checking received funds.':'Declining adds no credits. The reason is sent to the member.'}</p>
 {error&&<p role="alert" className="ad-error">{error}</p>}<footer className="bank-review-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="ad-primary" disabled={busy||(approve?(!confirmed||reference.trim().length<4):(!declineReason||(declineReason==='other'&&note.trim().length<8)))}>{busy?'Saving…':approve?'Approve':'Decline'}</button></footer>
 </form></dialog>
}
