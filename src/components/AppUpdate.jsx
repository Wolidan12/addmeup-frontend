import {useEffect,useRef,useState} from 'react'
import {useRegisterSW} from 'virtual:pwa-register/react'

export default function AppUpdate(){
 const registration=useRef(null),[dismissed,setDismissed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const {needRefresh:[ready],updateServiceWorker}=useRegisterSW({onRegisteredSW(_url,value){registration.current=value}})
 useEffect(()=>{
  const check=()=>{if(document.visibilityState==='visible')registration.current?.update().catch(()=>{/* Retry on next focus when online. */})}
  const timer=setInterval(check,60*60*1000)
  window.addEventListener('online',check);window.addEventListener('focus',check)
  return()=>{clearInterval(timer);window.removeEventListener('online',check);window.removeEventListener('focus',check)}
 },[])
 if(!ready||dismissed)return null
 return <section className="app-update" role="status" aria-label="Application update"><strong>A new version is ready</strong><p>Save any unfinished work, then update to get the latest improvements.</p><a href="/release-notes">Read release notes →</a>{error&&<p role="alert">{error}</p>}<div><button disabled={busy} onClick={()=>setDismissed(true)}>Later</button><button disabled={busy} onClick={async()=>{setBusy(true);try{await updateServiceWorker(true)}catch{setError('Could not update. Try closing and reopening the app.');setBusy(false)}}}>{busy?'Updating…':'Update now'}</button></div></section>
}
