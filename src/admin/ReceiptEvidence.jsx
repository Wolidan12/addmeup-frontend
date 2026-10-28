import {publicError,withTimeout} from '../lib/errors'
import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
export default function ReceiptEvidence({path}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[tick,setTick]=useState(0)
 useEffect(()=>{let active=true;setUrl('');setError('');if(!path)return
  withTimeout(supabase.storage.from('bank-receipts').createSignedUrl(path,120)).then(({data,error})=>{if(!active)return;if(error)setError(publicError(error,'The receipt could not be opened. Please retry.'));else setUrl(data.signedUrl)}).catch(()=>{if(active)setError('The receipt could not be opened. Please retry.')})
  return()=>{active=false}
 },[path,tick])
 if(!path)return <p>No receipt submitted.</p>
 return <section><h3 className="font-semibold">Private payment evidence</h3><p className="text-amber-200">A screenshot is not proof of funds. Match the amount, beneficiary, payer and unique bank-statement transaction ID before approval.</p>{error&&<p className="ad-error" role="alert">{error}</p>}{url?<><a href={url} target="_blank" rel="noopener noreferrer">Open receipt (link expires after 2 minutes) ↗</a><img src={url} alt="Submitted transfer receipt" className="max-h-80 w-full object-contain my-3 rounded-lg"/></>:!error&&<p role="status">Loading receipt…</p>}<button type="button" onClick={()=>setTick(t=>t+1)}>Refresh secure receipt link</button></section>
}
