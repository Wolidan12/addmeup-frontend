import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {useAuth} from '../context/AuthContext'
import {supabase} from '../lib/supabase'
import {withTimeout,publicError} from '../lib/errors'
export default function RelationshipActions({profile,onChanged,onBlocked}){
 const {user}=useAuth(),[connected,setConnected]=useState(!!profile.is_connected),[saved,setSaved]=useState(!!profile.is_saved),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),dialog=useRef(null)
 useEffect(()=>{setConnected(!!profile.is_connected);setSaved(!!profile.is_saved)},[profile.id,profile.is_connected,profile.is_saved])
 useEffect(()=>{if(confirm)dialog.current.showModal()},[confirm])
 if(profile.managed||user?.id===profile.id)return null
 if(!user)return <Link to="/login">Sign in to connect for free →</Link>
 async function act(action,value){setBusy(true);setMessage('');try{const {error}=await withTimeout(supabase.rpc('discovery_relationship',{p_target:profile.id,p_action:action,p_enabled:value}));if(error)throw error;if(action==='connect')setConnected(value);if(action==='save')setSaved(value);setMessage('Updated. Connections and saves are free; no DC or XP changed.');if(action==='block'){setConfirm(false);onBlocked?.()}onChanged?.()}catch(e){setMessage(publicError(e,'This relationship could not be updated.'))}finally{setBusy(false)}}
 return <div className="relationship-actions"><div><button disabled={busy} aria-pressed={connected} onClick={()=>act('connect',!connected)}>{connected?'Disconnect':'Connect · free'}</button><button disabled={busy} aria-pressed={saved} onClick={()=>act('save',!saved)}>{saved?'Unsave':'Save favourite'}</button><button disabled={busy} onClick={()=>setConfirm(true)}>Block</button></div>{message&&<small role="status">{message}</small>}{confirm&&<dialog ref={dialog} className="ad-dialog" aria-labelledby={'block-'+profile.id} onCancel={e=>{if(busy)e.preventDefault();else setConfirm(false)}}><h2 id={'block-'+profile.id}>Block @{profile.username}?</h2><p>You will be hidden from each other in discovery, profile reads and paid placements. Both directions of connections and favourites are removed. You can manage your blocks in My connections.</p><div className="ad-dialog-actions"><button disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button><button className="ad-primary" disabled={busy} onClick={()=>act('block',true)}>Confirm block</button></div></dialog>}</div>
}
