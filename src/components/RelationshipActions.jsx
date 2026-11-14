import {relationshipMessage} from '../lib/connectionRewards'
import {useMember} from '../member/MemberContext'
import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {MoreHorizontal} from 'lucide-react'
import {useAuth} from '../context/AuthContext'
import {supabase} from '../lib/supabase'
import {withTimeout,publicError} from '../lib/errors'

export default function RelationshipActions({profile,onChanged,onBlocked,onMessage,compact=false}){
 const member=useMember()
 const {user}=useAuth(),[connected,setConnected]=useState(!!profile.is_connected),[saved,setSaved]=useState(!!profile.is_saved),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),dialog=useRef(null)
 useEffect(()=>{setConnected(!!profile.is_connected);setSaved(!!profile.is_saved)},[profile.id,profile.is_connected,profile.is_saved])
 useEffect(()=>{if(confirm)dialog.current?.showModal()},[confirm])
 if(profile.managed||user?.id===profile.id)return null
 if(!user)return compact?<div className="relationship-actions relationship-actions-compact"><Link to="/login">Sign in to connect for free →</Link></div>:<Link to="/login">Sign in to connect for free →</Link>
 async function act(action,value){setBusy(true);setMessage('');onMessage?.('');try{const {data,error}=await withTimeout(supabase.rpc('discovery_relationship',{p_target:profile.id,p_action:action,p_enabled:value}));if(error)throw error;if(!data||data.action!==action||data.enabled!==value)throw new Error('Unconfirmed relationship response');if(action==='connect')setConnected(value);if(action==='save')setSaved(value);if(onMessage)onMessage(relationshipMessage(data));else setMessage(relationshipMessage(data));if(action==='connect'&&value)member?.refresh();if(action==='block'){setConfirm(false);onBlocked?.()}onChanged?.(data)}catch(e){const publicMessage=publicError(e,'This relationship could not be updated.');if(onMessage)onMessage(publicMessage);else setMessage(publicMessage)}finally{setBusy(false)}}
 function closeMenu(event){event.currentTarget.closest('details')?.removeAttribute('open')}
 const blockDialog=confirm&&<dialog ref={dialog} className="ad-dialog" aria-labelledby={'block-'+profile.id} onCancel={event=>{if(busy)event.preventDefault();else setConfirm(false)}}><h2 id={'block-'+profile.id}>Block @{profile.username}?</h2><p>You will be hidden from each other in discovery, profile reads and paid placements. Both directions of connections and favourites are removed. You can manage your blocks in My connections.</p><div className="ad-dialog-actions"><button disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button><button className="ad-primary" disabled={busy} onClick={()=>act('block',true)}>Confirm block</button></div></dialog>
 if(compact)return <div className="relationship-actions relationship-actions-compact"><div className="relationship-action-toolbar"><button className="relationship-connect" disabled={busy} aria-pressed={connected} onClick={()=>act('connect',!connected)}>{connected?'Disconnect':'Connect · free'}</button><details className="relationship-more"><summary aria-label="More profile actions"><MoreHorizontal size={20}/></summary><div className="relationship-more-menu"><button disabled={busy} aria-pressed={saved} onClick={event=>{closeMenu(event);act('save',!saved)}}>{saved?'Remove favourite':'Save favourite'}</button><button disabled={busy} onClick={event=>{closeMenu(event);setConfirm(true)}}>Block profile</button><small>Connections are free. The first eligible connection earns 7 reward DC once per pair, up to 50 rewarded connections per UTC day.</small></div></details></div>{message&&<small role="status">{message}</small>}{blockDialog}</div>
 return <div className="relationship-actions"><div><button disabled={busy} aria-pressed={connected} onClick={()=>act('connect',!connected)}>{connected?'Disconnect':'Connect · free'}</button><button disabled={busy} aria-pressed={saved} onClick={()=>act('save',!saved)}>{saved?'Unsave':'Save favourite'}</button><button disabled={busy} onClick={()=>setConfirm(true)}>Block</button></div><small>First eligible connection: +7 reward DC · up to 50 per UTC day. Once per pair; reconnecting never earns again.</small>{message&&<small role="status">{message}</small>}{blockDialog}</div>
}
