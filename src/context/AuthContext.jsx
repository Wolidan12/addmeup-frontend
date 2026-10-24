import {createContext,useContext,useEffect,useState} from 'react'
import {supabase,isSupabaseConfigured} from '../lib/supabase'
const C=createContext(null); export const useAuth=()=>useContext(C)
const DEMO_KEY='danqel_demo_user'
export function AuthProvider({children}){const [user,setUser]=useState(null),[loading,setLoading]=useState(true)
 useEffect(()=>{ if(!isSupabaseConfigured){try{setUser(JSON.parse(localStorage.getItem(DEMO_KEY)))}catch{} setLoading(false);return}
  supabase.auth.getSession().then(({data})=>{setUser(data.session?.user||null);setLoading(false)}); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null)); return ()=>data.subscription.unsubscribe()},[])
 const signUp=async(email,password)=>{ if(isSupabaseConfigured) return supabase.auth.signUp({email,password,emailRedirectTo:window.location.origin+'/login'}); const u={id:'demo-'+Date.now(),email,demo:true}; localStorage.setItem(DEMO_KEY,JSON.stringify(u)); setUser(u); return {data:{user:u},error:null}}
 const signIn=async(email,password)=>{ if(isSupabaseConfigured) return supabase.auth.signInWithPassword({email,password}); const u={id:'demo-local',email,demo:true}; localStorage.setItem(DEMO_KEY,JSON.stringify(u)); setUser(u); return {error:null}}
 const signOut=async()=>{ if(isSupabaseConfigured) await supabase.auth.signOut(); localStorage.removeItem(DEMO_KEY); setUser(null)}
 const reset=async(email)=> isSupabaseConfigured? supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/reset-password'}) : {error:null}
 return <C.Provider value={{user,loading,signUp,signIn,signOut,reset,isDemo:!isSupabaseConfigured}}>{children}</C.Provider>}
