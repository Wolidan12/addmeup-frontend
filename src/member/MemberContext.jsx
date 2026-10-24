import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react'
import {useAuth} from '../context/AuthContext'
import {supabase,isSupabaseConfigured} from '../lib/supabase'
const C=createContext(null)
export const useMember=()=>useContext(C)
export function MemberProvider({children}){
 const {user}=useAuth(),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[referralNotice,setReferralNotice]=useState(''),tried=useRef(null)
 const refresh=useCallback(async()=>{
  if(!isSupabaseConfigured){setError('Your workspace is temporarily unavailable. Please try again later.');setBusy(false);return}
  setBusy(true);setError('')
  try{const {data,error}=await supabase.rpc('member_overview');if(error)throw error;setData(data)}catch{setError('We couldn’t refresh your workspace. Please try again.')}finally{setBusy(false)}
 },[user.id])
 useEffect(()=>{setData(null);refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh()},60000);return()=>clearInterval(timer)},[refresh])
 useEffect(()=>{if(!data||tried.current===user.id)return;tried.current=user.id
  const code=localStorage.getItem('danqel_pending_referral');if(!code)return
  if(data.referred_by){localStorage.removeItem('danqel_pending_referral');return}
  supabase.rpc('apply_referral',{p_code:code}).then(({error})=>{if(error)setReferralNotice('Your referral link could not be applied. Open Referrals to review the code.');else{localStorage.removeItem('danqel_pending_referral');setReferralNotice('Your referral has been linked.');refresh()}})
 },[data,user.id,refresh])
 return <C.Provider value={{data,error,busy,refresh,referralNotice}}>{children}</C.Provider>
}
