import {InputError} from '../lib/errors.js'
export const declineReasons={funds_missing:'Funds have not been received in the bank account.',amount_mismatch:'The received amount does not match this order.',receipt_invalid:'The receipt is invalid or unrelated to this transfer.',other:'Other reason'}
export function bankReviewPayload(row,{approve,reference='',confirmed=false,declineReason='',note=''}={}){
 if(typeof approve!=='boolean'||!row?.id||row.status!=='submitted')throw new InputError('This deposit is no longer awaiting review. Refresh the list.')
 const notes=String(note).trim()
 if(notes.length>800)throw new InputError('Keep the optional note within 800 characters.')
 if(!approve){
  if(!Object.hasOwn(declineReasons,declineReason))throw new InputError('Choose a reason for declining.')
  if(declineReason==='other'&&notes.length<8)throw new InputError('Add a decline reason of at least eight characters.')
  return {p_order:row.id,p_approve:false,p_bank_reference:null,p_received_kobo:null,p_currency:null,p_recipient:null,p_reason:declineReason==='other'?notes:declineReasons[declineReason]+(notes?' '+notes:'')}
 }
 const amount=Number(row.amount_kobo),points=Number(row.points),ref=reference.trim()
 if(!Number.isSafeInteger(amount)||amount<=0||amount%100!==0||amount>100000000||!Number.isFinite(points)||points<=0||Math.abs(points*100-amount)>0.000001||row.account_number!=='6977298247')throw new InputError('The order amount or receiving account needs review. Do not approve it.')
 if(!confirmed)throw new InputError('Confirm that you checked the received funds before approving.')
 if(ref.length<4||ref.length>120)throw new InputError('Enter the transaction reference from the receiving-bank statement.')
 return {p_order:row.id,p_approve:true,p_bank_reference:ref,p_received_kobo:amount,p_currency:'NGN',p_recipient:row.account_number,p_reason:'Receiving-bank statement checked; exact amount and beneficiary confirmed.'+(notes?' '+notes:'')}
}
