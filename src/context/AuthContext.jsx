import {createContext,useContext,useEffect,useState} from 'react'
import {supabase,isSupabaseConfigured} from '../lib/supabase'
const C=createContext(null)
export const useAuth=()=>useContext(C)
const unavailable=()=>({error:{message:'Account services are temporarily unavailable. Please try again later.'}})
export function AuthProvider({children}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true)
 useEffect(()=>{
  // Retire old local-only sessions. Never create fake accounts when configuration is absent.
  localStorage.removeItem('danqel_demo_user')
  const ref=new URLSearchParams(window.location.search).get('ref')
  if(ref&&/^[a-zA-Z0-9-]{4,64}$/.test(ref))localStorage.setItem('danqel_pending_referral',ref)
  if(!isSupabaseConfigured){setLoading(false);return}
  let active=true
  supabase.auth.getSession().then(({data})=>{if(active){setUser(data.session?.user||null);setLoading(false)}}).catch(()=>{if(active)setLoading(false)})
  const {data}=supabase.auth.onAuthStateChange((_e,s)=>{setUser(s?.user||null);setLoading(false)})
  return()=>{active=false;data.subscription.unsubscribe()}
 },[])
 const signUp=async(email,password)=>{
  if(!isSupabaseConfigured)return unavailable()
  const ref=localStorage.getItem('danqel_pending_referral')
  return supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+'/login'+(ref?'?ref='+encodeURIComponent(ref):'')}})
 }
 const signIn=async(email,password)=>isSupabaseConfigured?supabase.auth.signInWithPassword({email,password}):unavailable()
 const signOut=async()=>{if(isSupabaseConfigured){const {error}=await supabase.auth.signOut();if(error)throw error}setUser(null)}
 const reset=async(email)=>isSupabaseConfigured?supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/reset-password'}):unavailable()
 return <C.Provider value={{user,loading,signUp,signIn,signOut,reset}}>{children}</C.Provider>
}
