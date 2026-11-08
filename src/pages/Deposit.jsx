import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {Wallet,ShieldCheck} from 'lucide-react'
import {useMember} from '../member/MemberContext'
import {supabase} from '../lib/supabase'
import {publicError} from '../lib/errors'
import {loadDepositBank} from '../member/depositBank'
import BuyPoints from '../components/BuyPoints'
import WorkspaceNav from '../components/WorkspaceNav'
import './deposit.css'

export default function Deposit(){
 const {refresh}=useMember(),[bank,setBank]=useState(null),[error,setError]=useState(''),[copy,setCopy]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0)
 useEffect(()=>{let active=true;setBank(null);setError('');setCopy('');setLoading(true)
  loadDepositBank(supabase).then(data=>{if(active)setBank(data)}).catch(e=>{if(active)setError(publicError(e,'Bank details could not be confirmed. Do not transfer. Contact support or retry.'))}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[attempt])
 async function copyAccount(){setCopy('');try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(bank.account_number);setCopy('Account number copied. Do not transfer until an active order confirms these details.')}catch{setCopy('Copy is unavailable in this browser. Select the account number manually.')}}
 return <main><WorkspaceNav/><div className="member-page-heading"><div><p className="member-eyebrow">MONIEPOINT · MANUAL FUNDING</p><h1>Deposit DC.</h1><p>₦1 = 1 DC. Create an order before sending money.</p></div><span className="member-page-icon"><Wallet size={25}/></span></div>
 <section className="member-panel deposit-bank" aria-labelledby="deposit-bank-title"><div className="deposit-bank-head"><ShieldCheck size={24}/><div><h2 id="deposit-bank-title">Moniepoint beneficiary</h2><p>Reference details only—not confirmation that deposits are available.</p></div></div>
 <p className="member-notice">Do not transfer just because an account number is shown. First create an active order below and check its amount, account number and beneficiary name. If order creation is unavailable, wait. If you already paid, contact support with your bank reference; do not pay twice.</p>
 {loading?<p role="status">Checking beneficiary details…</p>:bank?<><dl className="deposit-bank-grid"><div><dt>Bank</dt><dd>{bank.bank_name}</dd></div><div><dt>Account number</dt><dd className="deposit-account">{bank.account_number}</dd></div><div><dt>Account name</dt><dd>{bank.account_name}</dd></div></dl><button className="btn2" onClick={copyAccount}>Copy account number</button>{copy&&<p role="status">{copy}</p>}</>:<><p role="alert">{error}</p><button className="btn2" onClick={()=>setAttempt(a=>a+1)}>Retry bank details</button></>}
 <p>Receipts are supporting evidence, not proof of cleared funds. Only an authorized reviewer can credit DC after independently confirming the transfer. No cash withdrawals.</p></section>
 {bank?<BuyPoints onChanged={refresh}/>:<p className="member-notice">Order processing is locked until beneficiary details are confirmed. Your existing records remain available in the wallet.</p>}<div className="deposit-links"><Link to="/wallet">Back to wallet</Link><Link to="/support">Contact support</Link></div>
 </main>
}
