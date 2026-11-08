import {useEffect,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {useAuth} from '../../context/AuthContext'
import {supabase,isSupabaseConfigured} from '../../lib/supabase'
import {publicError} from '../../lib/errors'
import {verifyBotOwner} from './ownerAccess'
import './botgen.css'

export default function OwnerLogin(){
 const {user,loading,sessionError,retrySession,signIn,signOut}=useAuth(),navigate=useNavigate()
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[authorization,setAuthorization]=useState('checking'),[attempt,setAttempt]=useState(0)
 useEffect(()=>{
  if(loading||!user){setAuthorization('checking');return}
  let active=true;setAuthorization('checking');setError('')
  verifyBotOwner(supabase).then(allowed=>{if(!active)return;if(allowed)navigate('/admin?view=bot_generator',{replace:true});else setAuthorization('denied')}).catch(e=>{if(active){setAuthorization('error');setError(publicError(e,'Owner authorization could not be verified. Access remains locked.'))}})
  return()=>{active=false}
 },[user?.id,loading,navigate,attempt])
 async function login(event){
  event.preventDefault();if(busy||loading||!isSupabaseConfigured)return;setBusy(true);setError('')
  try{const {error}=await signIn(email,password);if(error)throw error;setPassword('')}catch(e){setPassword('');setError(publicError(e,'Sign-in failed. Check your credentials and try again.'))}finally{setBusy(false)}
 }
 async function logout(){setBusy(true);setError('');try{await signOut()}catch(e){setError(publicError(e,'Sign-out failed. Please retry.'))}finally{setBusy(false)}}
 return <main className="bg-access"><section className="bg-control"><div className="bg-hero"><div><span className="bg-terminal">DANQEL // OWNER ACCESS</span><h1>Private automation.<br/>Verified control.</h1><p>Bot Generator · existing owner account only</p></div><span className="bg-badge">RESTRICTED</span></div>
 {loading?<p role="status">Restoring your session…</p>:sessionError?<div role="alert"><p>Session verification is unavailable. The workspace is locked.</p><button disabled={busy} onClick={retrySession}>Retry session</button></div>:user?<div><p>Signed in as {user.email}</p>{authorization==='checking'?<p role="status">Verifying your server-side owner grant…</p>:authorization==='denied'?<div role="alert"><h2>Owner access denied</h2><p>A signed-in account or staff role does not grant ownership. Only the separately provisioned owner can open this module.</p></div>:<p role="alert">Owner access could not be verified. No workspace data has been opened.</p>}<div className="bg-tabs"><button disabled={busy||authorization==='checking'} onClick={()=>setAttempt(a=>a+1)}>Recheck owner access</button><button disabled={busy} onClick={logout}>Sign out of this account</button></div></div>:<form onSubmit={login} className="bg-login-form"><label>Owner email<input type="email" required autoComplete="username" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label><label>Password<input type="password" required autoComplete="current-password" maxLength={1024} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label><button disabled={busy||!isSupabaseConfigured} type="submit">{busy?'Signing in…':'Sign in as owner'}</button>{!isSupabaseConfigured&&<p role="alert">Account services are not configured. Sign-in is unavailable.</p>}<Link to="/forgot-password">Recover your existing account</Link></form>}
 {error&&<p role="alert">{error}</p>}<p className="bg-notice">No registration or ownership assignment is available here. Database recovery and trusted owner enrollment must be verified before live use.</p><Link to="/">Return to platform</Link>
 </section></main>
}
