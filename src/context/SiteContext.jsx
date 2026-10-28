import {withTimeout} from '../lib/errors'
import {createContext,useContext,useEffect,useState} from 'react'
import {supabase,isSupabaseConfigured} from '../lib/supabase'
import {PLATFORMS} from '../lib/validation'
const defaults={brand_name:'Danqel Social Boost',hero_title:'Good connections. Greater reach.',hero_description:'Meet creators, share your social profiles and make meaningful connections.',maintenance_mode:false,enabled_platforms:PLATFORMS}
const C=createContext(defaults)
export const useSite=()=>useContext(C)
export function SiteProvider({children}){
 const [settings,setSettings]=useState(defaults)
 useEffect(()=>{if(!isSupabaseConfigured)return;let active=true
  const load=()=>withTimeout(supabase.from('site_settings').select('*').eq('id',true).single()).then(({data})=>{if(active&&data)setSettings(data)}).catch(()=>{/* Keep safe public defaults; never expose setup errors. */})
  load();const timer=setInterval(()=>{if(document.visibilityState==='visible')load()},60000)
  return()=>{active=false;clearInterval(timer)}
 },[])
 useEffect(()=>{document.title=settings.brand_name},[settings.brand_name])
 return <C.Provider value={settings}>{children}</C.Provider>
}
